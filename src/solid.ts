import {projectedPathBounds} from './projectedGeometry.js';
import type {LottiePathNode} from './paths.js';
/** A solid remains a layer identity. Only an unmasked rect, or one fully opaque,
 * non-inverted additive mask entirely inside it, is qualified. Other masks stay
 * tree-selectable but have neither fabricated contours nor pointer candidates.
 */
export function resolveSolidProjection(layerElement:SVGElement|undefined,node:LottiePathNode):{path:SVGGraphicsElement;d:string;qualifiedClip?:Element}|null{
 if(!layerElement||!node.solid||node.solid==='unsupported')return null;
 const rect=Array.from(layerElement.children).find(e=>e.tagName==='rect') as SVGRectElement|undefined;
 if(!rect||rect.hasAttribute('transform')||rect.hasAttribute('mask')||rect.hasAttribute('clip-path'))return null;
 const bounds=rect.getBBox();if(bounds.width<=0||bounds.height<=0)return null;
 if(node.solid==='unmasked')return{path:rect,d:`M${bounds.x},${bounds.y}h${bounds.width}v${bounds.height}h${-bounds.width}Z`};
 const clip=layerElement.getAttribute('clip-path'),id=clip?.match(/#([^)'"\s]+)/)?.[1];
 const definition=id?rect.ownerDocument.getElementById(id):null;
 if(!definition||definition.children.length!==1||definition.getAttribute('clipPathUnits')==='objectBoundingBox')return null;
 const mask=definition.children[0] as SVGPathElement;
 if(mask.tagName!=='path'||!mask.getAttribute('d'))return null;
 if([definition,mask].some(e=>['transform','mask','clip-path'].some(name=>e.hasAttribute(name)||(e as SVGElement).style?.getPropertyValue(name))))return null;
 const extent=projectedPathBounds(mask.getAttribute('d')!);if(!extent)return null;
 // Bounding extent is only a containment qualification. Picking uses the exact
 // evaluated mask path with native Path2D, never this bounding rectangle.
 if(extent.width<=0||extent.height<=0||extent.x<bounds.x||extent.y<bounds.y||extent.x+extent.width>bounds.x+bounds.width||extent.y+extent.height>bounds.y+bounds.height)return null;
 return{path:rect,d:mask.getAttribute('d')!,qualifiedClip:definition};
}
