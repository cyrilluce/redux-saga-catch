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
  fork,
  cancel,
  take
} from "redux-saga/effects";

/**
 * Rename function
 *
 * @param {string} name
 * @param {Function} fn
 */
function named(name, fn) {
  Object.defineProperty(fn, "name", {
    value: name
  });
  return fn;
}

/**
 * The default error handler which calls `console.error`
 * 调用`console.error`的默认错误处理程序
 * @param {Error} error
 */
const defaultErrorHandler = function (error) {
  console.error("Error caught by redux-saga-catch: ", error);
};

/**
 * Quick wrap a saga with `try catch`
 * 快速使用try catch包装saga
 * @param {Saga} saga
 * @param {Function} [errorHandler=defaultErrorHandler]
 */
export function tryCatch(saga, errorHandler = defaultErrorHandler) {
  const wrapped = named(`try(${saga.name})`, function* wrappedTryCatch() {
    try {
      yield call(saga, ...arguments);
    } catch (e) {
      errorHandler(e);
    }
  });
  /** For debug trace. 用于调试时跟踪原始代码 */
  wrapped._original = saga;
  return wrapped;
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
 * @param {Function} [errorHandler=defaultErrorHandler]
 */
export function parallel(sagas, errorHandler = defaultErrorHandler) {
  return call(function* (sagas) {
    for (let i = 0; i < sagas.length; i++) {
      yield fork(tryCatch(sagas[i], errorHandler));
    }
  }, sagas);
}

/**
 * similar to takeLatest, buy fork saga first.
 * 与takeLatest相似，但会先fork执行一次saga。
 * takeLatest:  while( pattern ){ saga }
 * runAndTakeLatest:  do{ saga }while( pattern )
 * @param {*} pattern
 * @param {*} saga
 * @param {*} args
 */
export function runAndTakeLatest(pattern, saga, ...args) {
  saga = tryCatch(saga);
  return fork(
    named(`runAndTakeLatest(${saga.name})`, function* () {
      let lastTask, action;
      while (true) {
        if (lastTask) {
          yield cancel(lastTask); // cancel is no-op if the task has already terminated
        }
        lastTask = yield fork(saga, ...args, action);
        action = yield take(pattern);
      }
    })
  );
}
