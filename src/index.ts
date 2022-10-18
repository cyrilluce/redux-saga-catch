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
  Pattern as _Pattern,
  select,
  call,
  fork,
  cancel,
  take,
  ForkEffect,
} from "redux-saga/effects";
import * as deepEqual from 'fast-deep-equal'
import { CANCEL } from "redux-saga";

// compalibility with redux-saga 0.x
type Pattern = _Pattern<any>
type HelperResult = ForkEffect
/**
 * Rename function
 *
 * @param {string} name
 * @param {Function} fn
 */
export function named<T extends Function>(name: string, fn: T): T {
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
 * 
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
  // @ts-ignore
  wrapped._original = saga;
  return wrapped;
}

/**
 * Like saga's takeEvery, but swallow exception and don't cancel the takeEveryHelper.
 * 
 * 类似于saga原生的takeEvery，但是出错也不会导致监听中止
 * @param {*} pattern
 * @param {Saga} worker
 * @param {*} args
 */
export const takeEvery: typeof _takeEvery = function takeEvery(pattern, worker, ...args: any[]) {
  // @ts-ignore
  return _takeEvery(pattern, tryCatch(worker), ...args);
}

/**
 * Like saga's takeLatest, but swallow exception and don't cancel the takeLatestHelper.
 * 
 * 类似于saga原生的takeLatest，但是出错也不会导致监听中止
 * @param {*} pattern
 * @param {Saga} worker
 * @param {*} args
 */
export const takeLatest: typeof _takeLatest = function takeLatest(pattern, worker, ...args) {
  // @ts-ignore
  return _takeLatest(pattern, tryCatch(worker), ...args);
}

/**
 * Like saga's throttle, but swallow exception and don't cancel the throttleHelper.
 * 
 * 类似于saga原生的throttle，但是出错也不会导致监听中止
 */
export const throttle: typeof _throttle = function throttle(ms, pattern, worker, ...args) {
  // @ts-ignore
  return _throttle(ms, pattern, tryCatch(worker), ...args);
}

/**
 * run child sagas parallel, and child saga's exception don't cancel current saga.
 * 
 * 并行执行多个子saga，并且子saga出错不会影响父saga以及其它同级saga。
 *
 * usage/用法:
 * ```typescript
 * yield parallel([function*(){}, ...sagas])
 * ```
 */
export function parallel(sagas, errorHandler = defaultErrorHandler): ReturnType<typeof call> {
  return call(function* (sagas) {
    for (let i = 0; i < sagas.length; i++) {
      yield fork(tryCatch(sagas[i], errorHandler));
    }
  }, sagas);
}

/**
 * similar to takeLatest, buy fork saga first.
 * 
 * 与takeLatest相似，但会先fork执行一次saga。
 * 
 * Difference:
 *  - takeLatest:  while( pattern ){ saga }
 *  - runAndTakeLatest:  do{ saga }while( pattern )
 */
export function runAndTakeLatest(pattern, saga, ...args): HelperResult {
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


function watch<T>(
  types: Pattern,
  selector: (globalState: any) => T,
  ignoreOnce = false
) {
  let lastData: T
  return call(function* () {
    while (1) {
      let action
      // 可指定跳过首次
      if (ignoreOnce) {
        ignoreOnce = false
      } else {
        // 等待触发
        action = yield take(types)
      }
      // 判断值是否有变化
      const data = selector(yield select())
      if (!deepEqual(data, lastData)) {
        lastData = data
        // 有变化，开始执行任务
        return [data, action]
      }
    }
  })
}

/**
 * Similar to `takeLatest`, but only re-run on selector result changed.
 * 
 * 与 `takeLatest` 类似，但只在 `selector` 返回值有变化时重新执行.
 */
export function watchLatest<T>(
  types: Pattern,
  selector: (globalState: any) => T,
  saga: (data: T, action?) => IterableIterator<any>,
  runFirst = false
): HelperResult {
  saga = tryCatch(saga)
  const watcher = watch(types, selector, runFirst)
  return fork(
    named(
      runFirst
        ? `runAndWatchLatest(${saga.name})`
        : `watchLatest(${saga.name})`,
      function* () {
        let lastTask
        while (true) {
          const [data, action]: [T, any] = yield watcher
          if (lastTask) {
            yield cancel(lastTask) // cancel is no-op if the task has already terminated
          }
          lastTask = yield fork(saga, data, action)
        }
      }
    )
  )
}

/**
 * Similar to `runAndTakeLatest`, but only re-run on selector result changed.
 * 
 * 与 `runAndTakeLatest` 类似，但只在 `selector` 返回值有变化时重新执行.
 */
export function runAndWatchLatest<T>(
  types: Pattern,
  selector: (globalState: any) => T,
  saga: (data: T, action?) => IterableIterator<any>
): HelperResult {
  return watchLatest(types, selector, saga, true)
}

/** For legacy redux-saga(0.x) compatibility */
export function delay(ms) {
  var val = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

  var timeoutId = void 0;
  var promise = new Promise(function (resolve) {
    timeoutId = setTimeout(function () {
      return resolve(val);
    }, ms);
  });

  promise[CANCEL] = function () {
    return clearTimeout(timeoutId);
  };

  return promise;
}