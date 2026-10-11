// Small structural SVG test fixture: paint order/ancestry, not a substitute for browser pixel QA.
export function svgFixture(){
 const ns='http://www.w3.org/2000/svg';
 const doc={defaultView:{getComputedStyle:e=>({display:e.attrs.display??'inline',visibility:e.attrs.visibility??'visible',opacity:e.attrs.opacity??'1'})},createElementNS:(_,tag)=>new Element(tag)};
 class Element{
  constructor(tag){this.tagName=tag;this.namespaceURI=ns;this.ownerDocument=doc;this.attrs={};this.children=[];this.parentElement=null;this.style={getPropertyValue:()=>'',setProperty(){}};}
  get ownerSVGElement(){let parent=this.parentElement;while(parent&&parent.tagName!=='svg')parent=parent.parentElement;return parent;}
  get parentNode(){return this.parentElement;}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
  append(...elements){elements.forEach(e=>this.appendChild(e));}
  appendChild(e){e.remove();e.parentElement=this;this.children.push(e);return e;}
  insertBefore(e,before){e.remove();e.parentElement=this;this.children.splice(this.children.indexOf(before),0,e);return e;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(e=>e!==this);this.parentElement=null;}
  cloneNode(){const copy=new Element(this.tagName);copy.attrs={...this.attrs};return copy;}
 }
 const svg=new Element('svg'),group=new Element('g'),paint=new Element('path'),cover=new Element('g');
 svg.appendChild(group);group.appendChild(paint);svg.appendChild(cover);
 const descendants=e=>e.children.flatMap(child=>[child,...descendants(child)]);
 return{svg,group,paint,cover,doc,descendants};
}
