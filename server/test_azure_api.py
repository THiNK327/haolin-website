"""Run the API security/compute suite against durable snapshots, not local disk."""
import os
from unittest.mock import patch
import httpx
from server.state_store import blob_connect, StateStoreError
from server import test_api
from server import app as api
from server.test_state_store import FakeBlob


class AzureAPITests(test_api.APITests):
    async def asyncSetUp(self):
        self.blob = FakeBlob()
        self.backend = patch.dict(os.environ, {'STATE_BACKEND': 'azure_blob'})
        self.storage = patch.object(api, 'blob_connect', lambda: blob_connect(self.blob))
        self.backend.start()
        self.storage.start()
        await super().asyncSetUp()

    async def asyncTearDown(self):
        await super().asyncTearDown()
        self.storage.stop()
        self.backend.stop()

    async def test_session_and_budget_survive_restart(self):
        await self.login()
        with patch.object(api, 'compute', return_value={}):
            self.assertEqual((await self.client.post('/compare', json=self.payload())).status_code, 200)
        await self.life.__aexit__(None, None, None)
        self.life = api.lifespan(api.app)
        await self.life.__aenter__()
        status = (await self.client.get('/session')).json()
        self.assertTrue(status['verified'])
        self.assertEqual(status['remaining'], 19)

    async def test_storage_failure_is_503_and_no_calculation(self):
        await self.login()
        self.blob.fail = True
        with patch.object(api, 'compute') as compute:
            result = await self.client.post('/compare', json=self.payload())
            self.assertEqual(result.status_code, 503)
            compute.assert_not_called()
        self.blob.fail = False

    async def test_public_health_does_not_expose_private_routes(self):
        self.assertEqual((await self.client.get('/healthz', headers={'x-api-key': ''})).json(), {'ok': True})
        self.assertEqual((await self.client.get('/session', headers={'x-api-key': ''})).status_code, 401)

    async def test_resend_sender(self):
        # Stop the suite's email mock to test the adapter, while mocking HTTPS.
        self.mail.stop()
        with patch.dict(os.environ, {'EMAIL_PROVIDER': 'resend', 'RESEND_API_KEY': 'fake-test-key', 'EMAIL_FROM': 'verify@example.com'}):
            response = httpx.Response(200, json={'id': 'accepted'}, request=httpx.Request('POST', 'https://api.resend.com/emails'))
            with patch.object(api.httpx, 'post', return_value=response) as post:
                self.assertTrue(api.mail_ready())
                api.send_code('visitor@example.com', '123456')
                kwargs = post.call_args.kwargs
                self.assertEqual(kwargs['json']['from'], 'verify@example.com')
                self.assertEqual(kwargs['json']['to'], ['visitor@example.com'])
                self.assertIn('123456', kwargs['json']['text'])
                self.assertFalse(kwargs['follow_redirects'])
            failure = httpx.Response(403, request=httpx.Request('POST', 'https://api.resend.com/emails'))
            with patch.object(api.httpx, 'post', return_value=failure):
                result = await self.client.post('/auth/code', json={'email': 'visitor@example.com'})
                self.assertEqual(result.status_code, 503)
            with api.connect() as db:
                self.assertEqual(db.execute('SELECT count(*) FROM codes').fetchone()[0], 0)
