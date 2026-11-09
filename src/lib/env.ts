// 부작용 없는 환경 플래그. lib/firebase.ts 를 import 하지 않고도(시험 포함) 읽을 수 있다.
export const USING_EMULATOR: boolean = import.meta.env.VITE_USE_EMULATOR === '1';
