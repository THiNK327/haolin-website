import { Fragment, type ReactNode } from 'react';
import { ArrowUpRight, Download, Mail } from 'lucide-react';
import { profileLinks } from '@/data/profile';
import publications from '@/data/cv-publications.json';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { ProfileSections } from '@/components/profile-sections';
import { PlaygroundAction, ResearchPlaygroundLink } from '@/components/research-playground';

function Section({ id, number, label, title, children }: { id: string; number: string; label: string; title: string; children: ReactNode }) {
  return <section className="cv-section" id={id}><div className="cv-section-title"><div className="eyebrow">{number} / {label}</div><h2>{title}</h2></div><div className="cv-section-body">{children}</div></section>;
}
function External({ href, children }: { href: string; children: ReactNode }) {
  return <a className="text-link" href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={14} aria-hidden="true"/></a>;
}
function CitationText({ text }: { text: string }) {
  return <>{text.split(/(Wang, H\.|doi:10\.\S+|arXiv:\d+\.\d+)/g).map((part, index) => {
    if (part === 'Wang, H.') return <strong key={index}>{part}</strong>;
    if (part.startsWith('doi:')) return <External key={index} href={`https://doi.org/${part.slice(4)}`}>{part}</External>;
    if (part.startsWith('arXiv:')) return <External key={index} href={`https://arxiv.org/abs/${part.slice(6)}`}>{part}</External>;
    return <Fragment key={index}>{part}</Fragment>;
  })}</>;
}

export default function Home() {
  return <><a className="skip" href="#about">Skip to introduction</a><div className="wrap"><SiteHeader/><main>
    <section className="profile-intro" id="about" aria-labelledby="intro">
      <div className="profile-copy">
        <div className="eyebrow">Digital twins · Computer vision · Data quality · Automated maintenance</div>
        <h1 id="intro">Hi, I’m Haolin.</h1>
        <p className="profile-lead">I turn pavement surveys into reliable evidence for maintenance decisions.</p>
        <p className="profile-role"><strong>Ph.D. Student, Civil Engineering · Smart City Infrastructure Lab · Georgia Institute of Technology</strong><br/>Construction and Infrastructure Systems Engineering · Expected Fall 2027</p>
        <p>My research makes pavement condition data trustworthy enough to support life-cycle maintenance decisions. I assess data quality, align repeated and multi-sensor surveys, and develop evaluation methods that help distinguish real deterioration from measurement noise.</p>
        <p>My dissertation connects this work in a digital twin of pavement cracking: turning millimeter-resolution 3D surveys into persistent crack objects, keeping them synchronized over time, tracing uncertainty through the measurement pipeline, and using that record to guide treatment timing, location, and robotic crack sealing.</p>
        <p>I also teach data analytics and AI for civil engineering, currently as Head Teaching Assistant for CEE 3090.</p>
        <div className="hero-links"><PlaygroundAction toolId="crasdi"/><a className="button secondary" href={profileLinks.cv} download><Download size={16} aria-hidden="true"/>Download my CV</a></div>
        <p className="hero-example-note">Explore the research with preloaded examples. No sign-in or uploads needed.</p>
        <div className="hero-links"><External href={profileLinks.linkedin}>LinkedIn</External><External href={profileLinks.scholar}>Google Scholar</External><External href={profileLinks.orcid}>ORCID</External><a className="text-link" href="mailto:hwang972@gatech.edu"><Mail size={15} aria-hidden="true"/>Email me</a></div>
        <p className="dissertation-note"><strong>Dissertation:</strong> <em>Toward a Digital Twin of Pavement Cracking: Uncertainty-Aware Creation, Structured Diagnosis, and Treatment Prescription</em> (proposal in preparation, Fall 2026).</p>
      </div>
      <div className="profile-side">
        <aside className="portrait-card"><img className="headshot" src="/haolin-wang.png" width="486" height="470" alt="Haolin Wang"/><div className="portrait-caption"><strong>Haolin Wang</strong><span>Ph.D. Student · Georgia Tech</span><span>Atlanta, Georgia</span></div></aside>
        <ResearchPlaygroundLink toolId="crasdi" preview/>
      </div>
    </section>
    <ProfileSections>
      <Section id="skills" number="01" label="Core skills" title="What I bring to a problem">
        <div className="skill-grid">
          <article><h3>Quantitative evaluation</h3><p>Design interpretable metrics, compare methods, and diagnose where results disagree. My work includes graph-based comparison, dataset-wise rank-correlation analysis, and presence-aware benchmarks.</p></article>
          <article><h3>Computer vision & machine learning</h3><p>Work with crack detection, crack-object extraction, and feature-based and deformable registration, with attention to continuity, generalizability, and failure cases.</p></article>
          <article><h3>Data quality & temporal analysis</h3><p>Assess cracking data against ground references, trace measurement uncertainty, and align repeated surveys so meaningful condition changes can be separated from measurement noise.</p></article>
          <article><h3>Research software & communication</h3><p>Build reproducible Python pipelines and open benchmarks, connect measurements to maintenance decisions, and explain technical methods through teaching and hands-on tools.</p></article>
        </div>
        <p className="toolkit"><strong>Tools I work with</strong> Python · ArcGIS · SQL · MATLAB · Git/GitHub</p>
        <p className="toolkit"><strong>Languages</strong> English (fluent) · Mandarin Chinese (native)</p>
      </Section>
      <Section id="research" number="02" label="Research" title="Pavement crack digital twin">
        <p className="research-pipeline-intro">Creation, synchronization, and application connect raw survey data to life-cycle performance monitoring and maintenance decisions. Evaluation tools and standardization make that connection trustworthy.</p>
        <article className="cv-entry" id="research-creation"><div className="entry-kicker">01 / Digital twin creation</div><h3>Building a reliable crack record</h3>
          <p>I proposed a two-level cracking-data quality methodology: compare crack maps against ground references, then separate sensor limitations from detection-algorithm failures. Validation across pavement types, systems, and algorithms in Florida, Mississippi, and Texas provides a known-quality basis for condition histories. The paper is accepted in <em>Transportation Research Record</em>.</p>
          <p>I’m tracing how error enters through data collection, segmentation, vectorization, and aggregated metrics—and how much reaches the final condition rating. Repeat-run 3D laser surveys of US-80 provide the empirical benchmark for distinguishing deterioration from measurement noise. The manuscript is in preparation.</p>
          <p>I maintain and extend the lab’s Crack Vector Model (CVM), which turns crack masks and range images into node–link graphs with per-link width, length, and orientation. I’m also designing structure-aware thin-crack detection to reduce fragmentation where depth evidence is weak; that study is at an early stage.</p>
        </article>
        <article className="cv-entry" id="research-synchronization"><div className="entry-kicker">02 / Digital-physical synchronization</div><h3>Following change across years and sensors</h3>
          <p>I co-developed feature-based registration for repeated 3D pavement surveys, separating true deterioration from image-offset artifacts. This work was published in <em>Computer-Aided Civil and Infrastructure Engineering</em> in 2025. I’m also co-developing unsupervised deformable crack-map registration for crack-propagation monitoring.</p>
          <p>Another study calibrates low-cost RGB imagery against co-registered 3D laser surveys. It tests whether more frequent camera observations preserve the crack measures agencies act on, helping fill gaps between survey cycles and trigger high-resolution updates where change is detected. The deformable-registration and RGB-surrogate manuscripts are in preparation.</p>
          <div className="entry-links"><External href="https://doi.org/10.1111/mice.13407">Registration paper</External><External href="https://doi.org/10.5281/zenodo.22812774">TRACE preview dataset</External></div>
        </article>
        <article className="cv-entry" id="research-crack-density"><div className="entry-kicker">03 / Digital twin application</div><h3>Crack condition, severity, and treatment selection</h3>
          <p>I proposed a link-level crack-density indicator that replaces grid-based density with a buffer around each CVM crack link. It was calibrated and cross-validated on 150 crack maps spanning four crack types and road classes for alligator-crack classification, providing a consistent severity measure for treatment selection.</p>
          <p className="entry-citation"><em>ASCE Journal of Computing in Civil Engineering</em>, in revision.</p>
          <ResearchPlaygroundLink toolId="alligator-cracking"/>
        </article>
        <article className="cv-entry" id="research-crack-sealing"><div className="entry-kicker">03 / Digital twin application</div><h3>Planning robotic crack sealing</h3>
          <p>I formalized crack-sealing path planning as a sliding-window arc-routing problem, a Rural Postman Problem variant. As a sealing vehicle advances along the lane, a robotic arm must trace every crack within its operating constraints and satisfy a full-coverage requirement.</p>
          <p>The work connects treatment prescription with automated preventive maintenance. We are benchmarking heuristic, exact, and reinforcement-learning solvers with a reproducible pipeline on QA-checked road data. The manuscript is in preparation; the benchmark release is planned with it.</p>
        </article>
        <article className="cv-entry" id="research-lane-marking"><div className="entry-kicker">04 / Supporting toolbox</div><h3>OrthoLaneMark: measuring the right pavement region</h3>
          <p>I built a presence-aware lane-marking benchmark with 1,391 annotated orthographic 3D-laser images, a Gated Region Accuracy metric, and nine re-implemented detectors across four mechanisms. It examines how lane-marking presence reasoning, rather than sub-pixel localization alone, bounds wheelpath-region accuracy for pavement distress measurement.</p>
          <p className="entry-citation">Journal submission, September 2026; companion presentation accepted for TRB 2027.</p>
          <div className="entry-links"><External href="https://doi.org/10.5281/zenodo.23003579">OrthoLaneMark dataset</External><External href="https://doi.org/10.5281/zenodo.23005229">Trained checkpoints</External></div>
          <ResearchPlaygroundLink toolId="lane-marking"/>
        </article>
        <article className="cv-entry featured-entry" id="research-crasdi"><div className="entry-kicker">04 / Supporting toolbox · Try the examples</div><h3>CRASDI: explaining how two crack maps differ</h3>
          <p>I designed the CRAck Structural Difference Index (CRASDI), a modular, crack-topology-aware index that compares crack maps as graphs and decomposes their difference into geometry, length, width, and orientation.</p>
          <p>I benchmarked rank agreement against six conventional metrics on 1,405 prediction–reference pairs across nine public datasets, using dataset-wise Spearman correlations. I also diagnosed atypical rankings linked to annotation irregularities, thin crack traces, and repeated prediction failures, and released the Python package and reproducibility scripts.</p>
          <p className="entry-citation"><em>Computer-Aided Civil and Infrastructure Engineering</em>, under review.</p>
          <ResearchPlaygroundLink toolId="crasdi"/>
          <div className="entry-links"><External href="https://github.com/THiNK327/CRASDI">Code & documentation</External><External href="https://doi.org/10.5281/zenodo.22117845">Software DOI</External><External href="https://doi.org/10.5281/zenodo.22117905">Dataset DOI</External></div>
        </article>
        <article className="cv-entry" id="research-standardization"><div className="entry-kicker">05 / Standardization & framework</div><h3>Connecting the research to agency practice</h3>
          <p>As a core member of NCHRP 01-57B, I developed and validated quality-assessment and crack-definition protocols and contributed to the Final Report, Tech Brief, proposed revisions to AASHTO R 85, and crack-data aggregation standard. I co-authored panel-ballot responses and presented to the project panel and at RPUG in 2025 and 2026.</p>
          <p>I’m conducting a systematic review of pavement digital twins for life-cycle maintenance and rehabilitation decisions. The framework connects creation, synchronization, and application in a bidirectional loop: observations update the twin, and the twin guides monitoring and treatment. Its initial version was presented at the 2025 ACM SIGSPATIAL Workshop on Spatial Digital Twins.</p>
          <div className="entry-links"><External href="https://doi.org/10.1145/3764924.3770893">Digital-twin framework</External></div>
        </article>
      </Section>
      <Section id="publications" number="03" label="Publications" title="Papers & presentations">
        <p>† and * indicate equal contribution. Publication and manuscript statuses follow my current CV.</p>
        {publications.groups.map(group => <article className="cv-entry" key={group.title}><h3>{group.title}</h3><ol className="reference-list">{group.entries.map(entry => <li key={entry}><CitationText text={entry}/></li>)}</ol></article>)}
        <details className="details"><summary>Conference presentations ({publications.presentations.length})</summary><p>‡ indicates presentations delivered by Haolin. The January 2027 presentation is accepted and forthcoming.</p><ol className="reference-list">{publications.presentations.map(entry => <li key={entry}><CitationText text={entry}/></li>)}</ol></details>
      </Section>
      <Section id="resources" number="04" label="Open research" title="Software & datasets">
        <article className="cv-entry"><h3>CRASDI</h3><p>Wang, Ryu, Yang, Tsai (2026). Python package for crack-topology-aware crack-map comparison, with reproducibility scripts and per-pair results for nine public datasets.</p><div className="resource-action"><PlaygroundAction toolId="crasdi"/><small>See the idea before using the code. No upload needed.</small></div><div className="entry-links"><External href="https://github.com/THiNK327/CRASDI">Code</External><External href="https://doi.org/10.5281/zenodo.22117845">Software DOI</External><External href="https://doi.org/10.5281/zenodo.22117905">Dataset DOI</External></div></article>
        <article className="cv-entry"><h3>OrthoLaneMark</h3><p>Wang, Luo, Yang, Tsai (2026). Presence-aware benchmark for lane-marking detection: 1,391 annotated images, an evaluation framework, nine method implementations, and trained checkpoints.</p><div className="entry-links"><External href="https://doi.org/10.5281/zenodo.23003579">Dataset DOI</External><External href="https://doi.org/10.5281/zenodo.23005229">Checkpoints DOI</External></div><div className="resource-action"><PlaygroundAction toolId="lane-marking"/><small>Lane-marking Playground · Coming soon</small></div></article>
        <article className="cv-entry"><h3>TRACE</h3><p>Lou, Yang, Wang, Tsai (2026). Temporal Registered Annual Crack-map Evolution: a 20-sequence preview dataset.</p><div className="entry-links"><External href="https://doi.org/10.5281/zenodo.22812774">Dataset DOI</External></div></article>
        <article className="cv-entry"><h3>Crack-sealing path-planning benchmark</h3><p>Benchmarking heuristic, exact, and reinforcement-learning solvers with a reproducible pipeline on QA-checked road data. Release planned with the manuscript.</p></article>
      </Section>
      <Section id="background" number="05" label="Background" title="Education & experience">
        <article className="cv-entry"><div className="entry-kicker">Georgia Institute of Technology · Jan 2024–Expected Fall 2027</div><h3>Ph.D. in Civil Engineering</h3><p>Construction and Infrastructure Systems Engineering. Advisor: Dr. Yi-chang (James) Tsai. GPA 4.00.</p><p>Dissertation: <em>Toward a Digital Twin of Pavement Cracking: Uncertainty-Aware Creation, Structured Diagnosis, and Treatment Prescription</em> (proposal in preparation, Fall 2026).</p></article>
        <article className="cv-entry"><div className="entry-kicker">Georgia Institute of Technology · Aug 2022–Dec 2024</div><h3>M.S. in Computer Science & Engineering</h3></article>
        <article className="cv-entry"><div className="entry-kicker">Tongji University · Sept 2017–June 2021</div><h3>B.Eng. in Civil Engineering</h3><p>GPA 3.89. Recognized as an Excellent Graduate in 2021.</p></article>
        <article className="cv-entry"><div className="entry-kicker">Georgia Tech · Jan 2023–present</div><h3>Graduate Research Assistant</h3><p>Smart City Infrastructure Lab, advised by Dr. James Tsai. Projects funded by NCHRP and GDOT connect survey-data quality, pavement deterioration monitoring, and maintenance decisions.</p><div className="resource-action"><PlaygroundAction toolId="crasdi"/><small>A hands-on example of the graph-based evaluation work.</small></div><div className="entry-links"><a className="text-link" href="/#research">Explore the research background<ArrowUpRight size={14} aria-hidden="true"/></a></div></article>
        <article className="cv-entry"><div className="entry-kicker">Tongji University · 2019–2021</div><h3>Undergraduate Researcher</h3><p>I studied nondestructive acoustic-emission crack monitoring for high-speed-railway ballastless track slabs, linking acoustic signatures to finite-element-simulated crack propagation. This work with Dr. Yu Zhou led to two granted CNIPA patents.</p><p>With Dr. Yujie Lu, I investigated a life-cycle maturity model of intelligent construction in urban rail transit through literature review, questionnaires, and hierarchical analysis; the work was recognized as an excellent project.</p></article>
        <article className="cv-entry"><h3>Mini Traffic: urban-road simulator</h3><p>Team lead for the Mini Traffic urban-road simulator, awarded third prize in the Shanghai University Student Computer Application Ability Competition in 2019.</p></article>
        <details className="details"><summary>Patents (2)</summary><p>Nondestructive crack monitoring method for ballastless track slabs. China National Intellectual Property Administration, CN202010987184.0 (granted 2020).</p><p>Nondestructive testing method for ballastless track slabs in rail transit. China National Intellectual Property Administration, CN202010985244.5 (granted 2020).</p></details>
      </Section>
      <Section id="teaching" number="06" label="Teaching & mentoring" title="Helping others work with data">
        <article className="cv-entry"><div className="entry-kicker">Fall 2026 · Georgia Tech</div><h3>Head Teaching Assistant · CEE 3090</h3><p>Data Analytics in Civil & Environmental Engineering. I deliver lectures on tree-based methods, deep learning, and survival analysis, and lead the Python lab sequence from environment setup through regression, classification, cross-validation, and model selection.</p><p>I designed the five-lab Python curriculum—student notebooks, instructor keys, and slide decks—using real civil-engineering datasets: EPA PM2.5 monitors, UCI concrete strength, FHWA LTPP pavement sections, and the full Georgia National Bridge Inventory. An observational-confounding lesson prepares students for the course project.</p><p>I co-developed the midterm and term project, coordinate the TA team, assign responsibilities, and review student analyses and code with written feedback.</p><div className="award-note">2025 CEE Bill Schutz Graduate Teaching Assistant Award · Georgia Tech</div></article>
        <article className="cv-entry"><h3>Previous teaching</h3><p><strong>CEE 4803 AI for Smart Cities</strong> · Spring 2024 and Spring 2025. Lectures, Python labs, assignments, and grading rubrics for undergraduate and graduate students.</p><p><strong>CEE 8813 Data Analytics for Transportation Safety</strong> · Fall 2024. Python/GIS crash-analytics assignments and term-project mentoring.</p><p><strong>CEE 4803 Data Analytics in Civil & Environmental Engineering</strong> · Fall 2023 and Fall 2024. Assignments and lecture support in the course that became CEE 3090.</p></article>
        <article className="cv-entry"><div className="entry-kicker">Spring 2023–present</div><h3>Graduate Mentor · Vertically Integrated Projects</h3><p>I supervise undergraduate and graduate teams on semester-long research tasks, define scopes, run weekly check-ins, and review deliverables. Projects include crack-definition standardization, spatiotemporal pavement analysis, image registration, lane-marking annotation, and LiDAR-aided sidewalk assessment.</p><p>Mentees include Sooha Ryu, Jordan Fung, Jiao Bao, and Trinh Flynt. Mentees are co-authors on the CRASDI, crack-density, and deformable-registration manuscripts.</p></article>
        <article className="cv-entry"><h3>Teaching interests</h3><p>Data analytics and machine learning for civil engineering; infrastructure sensing and condition assessment; pavement engineering and asset management; digital twins and spatiotemporal data; optimization and maintenance automation; programming and reproducible research.</p></article>
      </Section>
      <Section id="service" number="07" label="Service & recognition" title="Contributing to the research community">
        <article className="cv-entry"><h3>Peer review</h3><p><strong>ASCE Journal of Computing in Civil Engineering</strong> · 16 reviews covering 10 manuscripts including revisions, 2024–present.</p><p><strong>Transportation Research Record</strong> · 2 reviews, 2026.</p><p><strong>TRB Annual Meeting</strong> · 6 papers for the 2026 and 2027 meetings.</p></article>
        <article className="cv-entry"><h3>Project and community</h3><p>Core team member, NCHRP Project 01-57B; presenter to the project panel and at the Road Profile Users’ Group in 2025 and 2026.</p></article>
        <article className="cv-entry"><h3>Honors & awards</h3><p>CEE Bill Schutz Graduate Teaching Assistant Award, Georgia Tech (2025); Excellent Graduate, Tongji University (2021); First Prize, Tongji Scholarship for Excellent Students (2020); Bronze Award, Fifth “Excellence Cup” Competition, Tongji University (2020); Third Prize, Shanghai University Student Computer Application Ability Competition (2019); Excellent Student Leader, Tongji University (2018 and 2019).</p></article>
      </Section>
      <Section id="contact" number="08" label="Contact" title="Let’s connect">
        <p>I’d be glad to connect about pavement digital twins, infrastructure sensing, data quality, computer vision, or building reproducible tools that connect research with maintenance decisions.</p><a className="contact-email" href="mailto:hwang972@gatech.edu">hwang972@gatech.edu<ArrowUpRight size={20} aria-hidden="true"/></a>
        <div className="entry-links"><External href={profileLinks.linkedin}>LinkedIn</External><External href={profileLinks.scholar}>Google Scholar</External><External href={profileLinks.orcid}>ORCID</External><External href="https://github.com/THiNK327">GitHub</External><a className="text-link" href={profileLinks.cv} download>Full academic CV<Download size={15} aria-hidden="true"/></a></div>
      </Section>
    </ProfileSections>
  </main><SiteFooter/></div></>;
}
