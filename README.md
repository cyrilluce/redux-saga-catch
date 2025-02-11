> [!IMPORTANT]
> This project is no longer maintained

---

# redux-saga-catch
Helper for redux-saga, auto wrap saga with try-catch, prevent one throw stop all.

redux-saga工具集，为了业务健壮，自动将saga进行try-catch包装，避免一个出错导致其它saga也出错中止。

# usage
## install
```sh
npm i redux-saga-catch -S
```

## helpers with auto try-catch
```js
import { takeEvery, takeLatest, throttle } from 'redux-saga-catch'

function* rootSaga(){
  yield takeEvery(ACTION1, function*(){
    console.log('ACTION1 will always trigger')
    throw 'exception'
  })
  // same as takeLatest、throttle
}
```

## new helper `parallel` use to combine sagas with auto try-catch
```js
import { parallel } from 'redux-saga-catch'
function* rootSaga(){
  yield parallel([
    function*(){
      throw 'exception'
    },
    function*(){
      yield call(delay, 1000)
      console.log('not affected')
    }
  ])
}
```

## new helper `runAndTakeLatest` use to run task once before `takeLatest`, trigger will abort first running
```js
import { runAndTakeLatest } from 'redux-saga-catch'

function* saga(){
  yield runAndTakeLatest(ACTION1, function*(){
    console.log('Will run once without `ACTION1` fired.')
  })
}
```

## new helper `watchLatest` and `runAndWatchLatest` use to re-run only `selector` returns changed.
```js
import { watchLatest } from 'redux-saga-catch'

function* saga(){
  yield watchLatest(ACTION1, globalState => globalState.data, function*(data){
    console.log('Only run on `globalState.data` changed (use deep equal).')
  })
}
```

# Upgrade from 0.0.9
1.x has added typescript support, if you are using 0.x, and meeting issue with typings check, you can overwrite `redux`'s `Action` interface
```typescript
declare module 'redux'{
  interface Action{
    type: any
    payload?: any
    [key: string]: any
  }
}
```
