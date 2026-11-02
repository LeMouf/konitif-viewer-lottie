import {inspectLottieProfile,type LottieSource} from './index.js';
const profiles=new WeakMap<LottieSource,{data:LottieSource['data'];revision:string;profile:ReturnType<typeof inspectLottieProfile>}>();
/** All readers share admission for an immutable source occurrence; edits create a new revision. */
export function readLottieSourceProfile(source:LottieSource){
 const cached=profiles.get(source);if(cached?.data===source.data&&cached.revision===source.revision)return cached.profile;
 const profile=inspectLottieProfile(source.data);profiles.set(source,{data:source.data,revision:source.revision,profile});return profile;
}
