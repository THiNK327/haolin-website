import {ArrowUpRight,ArrowRight} from 'lucide-react';
import './research-playground.css';
export function SiteHeader({playground=false}:{playground?:boolean}){
 return <header className="nav"><a className="brand" href="/" aria-label="Haolin Wang home"><span className="monogram">H</span>Haolin Wang</a><nav className="navlinks" aria-label="Main navigation"><a href="/" aria-current={!playground?'page':undefined}>About me</a><a className="playground-nav" href="/playground" aria-current={playground?'page':undefined}>Playground <ArrowRight size={13} aria-hidden="true"/></a></nav></header>
}
export function SiteFooter(){return <footer className="footer"><span>© {new Date().getFullYear()} Haolin Wang</span><a href="https://github.com/THiNK327" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={13} style={{display:'inline'}}/></a></footer>}
