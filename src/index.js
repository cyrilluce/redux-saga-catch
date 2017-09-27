/**
 * Helper for redux-saga, auto wrap saga with try-catch, prevent one throw stop all.
 * redux-saga工具集，为了业务健壮，自动将saga进行try-catch包装，避免一个出错导致其它saga也出错中止。
 * 
 * @author cyrilluce@gmail.com
 */
import {
  takeEvery as _takeEvery,
  takeLatest as _takeLatest,
  throttle as _throttle,
  call,
  spawn
} from "redux-saga/effects";

/**
 * Quick wrap a saga with `try catch`
 * 快速使用try catch包装saga
 * @param {Saga} saga 
 */
export function tryCatch(saga) {
  const wrapped = function* wrappedTryCatch() {
    try {
      yield call(saga, ...arguments)
    } catch (e) {
      console.error('Error caught by redux-saga-catch', e)
    }
  }
  /** For debug trace. 用于调试时跟踪原始代码 */
  wrapped._original = saga
  return wrapped
}

/**
 * Like saga's takeEvery, but swallow exception and don't cancel the takeEveryHelper.
 * 类似于saga原生的takeEvery，但是出错也不会导致监听中止
 * @param {*} pattern 
 * @param {Saga} worker 
 * @param {*} args 
 */
export function takeEvery(pattern, worker, ...args) {
  return _takeEvery(pattern, tryCatch(worker), ...args);
}

/**
 * Like saga's takeLatest, but swallow exception and don't cancel the takeLatestHelper.
 * 类似于saga原生的takeLatest，但是出错也不会导致监听中止
 * @param {*} pattern 
 * @param {Saga} worker 
 * @param {*} args 
 */
export function takeLatest(pattern, worker, ...args) {
  return _takeLatest(pattern, tryCatch(worker), ...args);
}

/**
 * Like saga's throttle, but swallow exception and don't cancel the throttleHelper.
 * 类似于saga原生的throttle，但是出错也不会导致监听中止
 * @param {*} ms 
 * @param {*} pattern 
 * @param {Saga} worker 
 * @param {*} args 
 */
export function throttle(ms, pattern, worker, ...args) {
  return _throttle(ms, pattern, tryCatch(worker), ...args);
}

/**
 * run child sagas parallel, and child saga's exception don't cancel current saga.
 * 并行执行多个子saga，并且子saga出错不会影响父saga以及其它同级saga。
 * 
 * usage/用法:
 * yield parallel([function*(){}, ...sagas])
 * @param {Saga[]} sagas 
 */
export function parallel(sagas) {
  return call(function*(sagas) {
    for (let i = 0; i < sagas.length; i++) {
      yield spawn(sagas[i]);
    }
  }, sagas);
}
