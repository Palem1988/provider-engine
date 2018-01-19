const map = require('async/map')
const eachSeries = require('async/eachSeries')

module.exports = Web3StatelessProviderEngine


function Web3StatelessProviderEngine(opts) {
  this._providers = []
}

// public

Web3StatelessProviderEngine.prototype.addProvider = function(source){
  const self = this
  self._providers.push(source)
  source.setEngine(this)
}

Web3StatelessProviderEngine.prototype.send = function(payload){
  throw new Error('Web3StatelessProviderEngine does not support synchronous requests.')
}

Web3StatelessProviderEngine.prototype.sendAsync = function(payload, cb){
    if (Array.isArray(payload)) {
      // handle batch
      map(payload, this._handleAsync.bind(self), cb)
    } else {
      // handle single
      this._handleAsync(payload, cb)
    }
}

// private

Web3StatelessProviderEngine.prototype._handleAsync = function(payload, finished) {
  var self = this
  var currentProvider = -1
  var result = null
  var error = null

  var stack = []

  next()

  function next(after) {
    currentProvider += 1
    stack.unshift(after)

    // Bubbled down as far as we could go, and the request wasn't
    // handled. Return an error.
    if (currentProvider >= self._providers.length) {
      end(new Error('Request for method "' + payload.method + '" not handled by any subprovider. Please check your subprovider configuration to ensure this method is handled.'))
    } else {
      try {
        var provider = self._providers[currentProvider]
        provider.handleRequest(payload, next, end)
      } catch (e) {
        end(e)
      }
    }
  }

  function end(_error, _result) {
    error = _error
    result = _result

    eachSeries(stack, function(fn, callback) {

      if (fn) {
        fn(error, result, callback)
      } else {
        callback()
      }
    }, function() {
      // console.log('COMPLETED:', payload)
      // console.log('RESULT: ', result)

      var resultObj = {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result: result
      }

      if (error != null) {
        resultObj.error = {
          message: error.stack || error.message || error,
          code: -32000
        }
        // respond with both error formats
        finished(error, resultObj)
      } else {
        finished(null, resultObj)
      }
    })
  }
}

