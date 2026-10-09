# Changelog

## [0.2.1](https://github.com/samuelcsantana/pyxis-sdk/compare/v0.2.0...v0.2.1) (2026-10-09)


### Documentation

* **readme:** state the published status ([2558c31](https://github.com/samuelcsantana/pyxis-sdk/commit/2558c310207b85315ef733c8fe2e6fad41017a25))

## [0.2.0](https://github.com/samuelcsantana/pyxis-sdk/compare/v0.1.0...v0.2.0) (2026-10-07)


### Features

* **playground:** show trackingStatus() next to the opt-out box ([20ea585](https://github.com/samuelcsantana/pyxis-sdk/commit/20ea585cda7f3b042c362416b0f29959c6aa702c))
* **privacy:** export trackingStatus() ([59ef2cf](https://github.com/samuelcsantana/pyxis-sdk/commit/59ef2cf0522b6ba91f4f125f1e91d20a0bafe5b5))
* **privacy:** resume measuring in the same page on optIn() ([f08b6cc](https://github.com/samuelcsantana/pyxis-sdk/commit/f08b6ccb25b70d086944bc2345deb39943887571))


### Bug Fixes

* **privacy:** keep an opt-out for the rest of the page when storage is blocked ([7e65908](https://github.com/samuelcsantana/pyxis-sdk/commit/7e659085fd5528a1b070e60a4981b8a8d04f06a9))


### Documentation

* **readme:** document trackingStatus() and what an opt-out drops ([73acdf4](https://github.com/samuelcsantana/pyxis-sdk/commit/73acdf408deb331336df835e0bb6323b8dd5966f))
* **readme:** say that optIn() resumes in the same page ([50053a8](https://github.com/samuelcsantana/pyxis-sdk/commit/50053a83becd0ec6360976385316e515f4842356))

## 0.1.0 (2026-10-06)


### Features

* **adapters:** add id generation and fault-tolerant storage ([1a0a845](https://github.com/samuelcsantana/pyxis-sdk/commit/1a0a845dfec6c3dbffd32c9bf58593b9954a65b7))
* **adapters:** add the transport, page lifecycle and privacy signal adapters ([fcdf5d9](https://github.com/samuelcsantana/pyxis-sdk/commit/fcdf5d95aaae8e07724a27cde0cdb6edec8c75ee))
* **adapters:** watch History API navigation ([a4218ee](https://github.com/samuelcsantana/pyxis-sdk/commit/a4218eee47c5457323031c9c3a8a4cc339625ee9))
* add trackRequest ([d0fc04b](https://github.com/samuelcsantana/pyxis-sdk/commit/d0fc04b7b373e681dca574b4435b503439c8b2c8))
* attach attribution only to the entry page view of a session ([d6c5a54](https://github.com/samuelcsantana/pyxis-sdk/commit/d6c5a5454cccfcc90c6b13730970f834e82c71e6))
* compose the core policies into a tracker ([d4c2d71](https://github.com/samuelcsantana/pyxis-sdk/commit/d4c2d713068fe3e4f1e5533a3d87dfc849247b3c))
* **core:** add path templating with custom rules ([36d8c69](https://github.com/samuelcsantana/pyxis-sdk/commit/36d8c691a5c1c21c6917355ad88ea8c4f8df6464))
* **core:** add session renewal ([1a7ba6d](https://github.com/samuelcsantana/pyxis-sdk/commit/1a7ba6dd99f2a3806eb930579261e540a741a3ae))
* **core:** add the batching policy ([db4ae2c](https://github.com/samuelcsantana/pyxis-sdk/commit/db4ae2c215c95fb7bc214c65b68336a67e8fe086))
* **core:** add the retry policy ([7308561](https://github.com/samuelcsantana/pyxis-sdk/commit/73085614ea33bacb005c0fbc2920c22a1d971c76))
* **core:** decide from privacy signals whether tracking may start ([339be94](https://github.com/samuelcsantana/pyxis-sdk/commit/339be9478dc36a3c4df3fb705b0cfb7936564f9c))
* **core:** read attribution from the landing URL and the referrer ([9f1a9e9](https://github.com/samuelcsantana/pyxis-sdk/commit/9f1a9e92028a526d28a83c262f2cdb8d17f6a627))
* **core:** resolve the init options ([2179a25](https://github.com/samuelcsantana/pyxis-sdk/commit/2179a2507884f0ac78a0f80491a176046b355464))
* **core:** turn an HTTP request into api_request properties ([4476433](https://github.com/samuelcsantana/pyxis-sdk/commit/4476433f00277eb8be0e5003146069142fc0385f))
* **core:** validate event names, user ids and properties ([ccfef7b](https://github.com/samuelcsantana/pyxis-sdk/commit/ccfef7b904f3bcccaa72f7f211631915cc8c34af))
* identify and reset visits in the tracker ([6fb4e22](https://github.com/samuelcsantana/pyxis-sdk/commit/6fb4e22d72a4aad93b7fe0c09a2e125517e1975f))
* make track, identify and reset public ([8ace800](https://github.com/samuelcsantana/pyxis-sdk/commit/8ace800eb7865ea0004e238ab33fae4fe00e8b9b))
* **playground:** show the batches the tracker would send, without sending them ([76b2328](https://github.com/samuelcsantana/pyxis-sdk/commit/76b2328151516d5a8a4ad2dd76e5cf89c7f07eac))
* record page views automatically ([b65266e](https://github.com/samuelcsantana/pyxis-sdk/commit/b65266e6c974309b0626fc11552eba5c0cb8ed60))
* start the tracker from init and honor optOut and optIn ([d40b81a](https://github.com/samuelcsantana/pyxis-sdk/commit/d40b81a077b2220ab94a5191f4b3080564cc06aa))


### Refactoring

* **adapters:** drop the Math.random fallback for event ids ([3534af1](https://github.com/samuelcsantana/pyxis-sdk/commit/3534af1be1ec3e497cf6dc3c5e85542dd55529d6))


### Documentation

* add community health files ([0f6c7c8](https://github.com/samuelcsantana/pyxis-sdk/commit/0f6c7c8df5edce651f6bef69997a25622715805d))
* add the readme, the brand assets and the first adrs ([2aa9a2e](https://github.com/samuelcsantana/pyxis-sdk/commit/2aa9a2ef00044c5823505a69fc7f51f52eba565a))
* describe what the core does today ([a1deb51](https://github.com/samuelcsantana/pyxis-sdk/commit/a1deb514d864906bba24ba8cf541c4e78f425355))
* document page views and the init options ([b325961](https://github.com/samuelcsantana/pyxis-sdk/commit/b325961149c12a9e912d1f030a21aa1dd4f089c2))
* document track, identify, reset and the contract test ([e1f8665](https://github.com/samuelcsantana/pyxis-sdk/commit/e1f8665cabc90560e847fb3152e3fa8bcf94c105))
* document trackRequest ([c536146](https://github.com/samuelcsantana/pyxis-sdk/commit/c536146d4701f8c5c65b59d120e5658aab6c3609))
* **readme:** link the dashboard Storybook and the API reference ([77929f3](https://github.com/samuelcsantana/pyxis-sdk/commit/77929f351248b064c1c8f8c0da0185e98cfdc71e))
* **readme:** link the playground ([b01f019](https://github.com/samuelcsantana/pyxis-sdk/commit/b01f019ee2489711ab8e74925537293e6a14e4f6))
