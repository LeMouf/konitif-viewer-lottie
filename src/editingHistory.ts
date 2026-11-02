import type {LottieSource} from './contracts.js';
/** Host-owned history. Editing borrows transactions; it owns no workspace or document store. */
export interface LottieEditingHistory {
 getStatus():{core:{canUndo:boolean;canRedo:boolean}};
 beginTransaction(scope:'core',source:LottieSource):unknown;
 commitTransaction(scope:'core',source:LottieSource):unknown;
 cancelTransaction(scope:'core'):LottieSource|null|undefined;
 undo(scope:'core',source:LottieSource):LottieSource|null|undefined;
 redo(scope:'core',source:LottieSource):LottieSource|null|undefined;
 reset():void;
}
