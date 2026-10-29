# Changelog

## [0.5.5](https://github.com/samuelcsantana/pyxis-sdk/compare/v0.5.4...v0.5.5) (2026-10-29)


### Documentation

* **readme:** shorten the status note and point the roadmap at the changelog ([0158ce2](https://github.com/samuelcsantana/pyxis-sdk/commit/0158ce2191937b6b284d9af77acb4616d9a6f99d))

## [0.5.4](https://github.com/samuelcsantana/pyxis-sdk/compare/v0.5.3...v0.5.4) (2026-10-29)


### Bug Fixes

* **core:** cut a long path after its last whole segment ([6393c90](https://github.com/samuelcsantana/pyxis-sdk/commit/6393c903bb2f02932a533ea9fcb3a1d61a67c3b4))
* **core:** cut a long request route after its last whole segment ([cfaaefd](https://github.com/samuelcsantana/pyxis-sdk/commit/cfaaefd2ba8082b5f63af5250cdc8fb4b321b5dc))


### Documentation

* **readme:** say how long paths and routes are cut ([53843bc](https://github.com/samuelcsantana/pyxis-sdk/commit/53843bc58d22ae240e6183bc225c4719cca0937f))

## [0.5.3](https://github.com/samuelcsantana/pyxis-sdk/compare/v0.5.2...v0.5.3) (2026-10-28)


### Bug Fixes

* **core:** ignore a Retry-After too large to be read exactly ([998f627](https://github.com/samuelcsantana/pyxis-sdk/commit/998f62729537c262ecc201e03ebdb4f164dd2c0d))
* **core:** report a __proto__ property as dropped instead of losing it ([5dc7146](https://github.com/samuelcsantana/pyxis-sdk/commit/5dc714603d332bbc61a5556cee3b111556448729))


### Documentation

* **readme:** describe the property-based tests and their fixed seed ([fe5a705](https://github.com/samuelcsantana/pyxis-sdk/commit/fe5a705e9411f8d45806b6ff16ff1a33ed07d353))

## [0.5.2](https://github.com/samuelcsantana/pyxis-sdk/compare/v0.5.1...v0.5.2) (2026-10-28)


### Documentation

* **readme:** add install steps, the hosted endpoint and the npm badges ([118146d](https://github.com/samuelcsantana/pyxis-sdk/commit/118146dd773cc695ed260bdb5478db3b61ecea29))
* **readme:** add the OpenSSF Scorecard badge ([e6ff1c4](https://github.com/samuelcsantana/pyxis-sdk/commit/e6ff1c40a1a9e040b16669c17420bbc3f960a418))

## [0.5.1](https://github.com/samuelcsantana/pyxis-sdk/compare/v0.5.0...v0.5.1) (2026-10-27)


### Documentation

* **readme:** bring the status and the roadmap up to date ([88b814b](https://github.com/samuelcsantana/pyxis-sdk/commit/88b814badbc4488f3b7c0e039a0e80d81b8fa74d))

## [0.5.0](https://github.com/samuelcsantana/pyxis-sdk/compare/v0.4.0...v0.5.0) (2026-10-18)


### Features

* **tracker:** send nothing more from a page after a refused batch ([7e1f070](https://github.com/samuelcsantana/pyxis-sdk/commit/7e1f07020443f1f832203e3a499eaa90fea88b88))


### Documentation

* **adr:** record why a refused batch stops the page ([995e99b](https://github.com/samuelcsantana/pyxis-sdk/commit/995e99b9975b36300a81c32c143f9c16be45d800))

## [0.4.0](https://github.com/samuelcsantana/pyxis-sdk/compare/v0.3.0...v0.4.0) (2026-10-18)


### Features

* **options:** accept the referrer of the visit's first page ([3145c11](https://github.com/samuelcsantana/pyxis-sdk/commit/3145c11a87ed614801100f0f89242eeb2b17cf4f))


### Documentation

* **readme:** document the referrer option ([2d09d41](https://github.com/samuelcsantana/pyxis-sdk/commit/2d09d41b98b70d4244b8a8e30b900a64a5c5f3b8))

## [0.3.0](https://github.com/samuelcsantana/pyxis-sdk/compare/v0.2.1...v0.3.0) (2026-10-16)


### ⚠ BREAKING CHANGES

* **privacy:** a browser driven by automation is no longer measured. End-to-end tests that expect events must launch Chromium with --disable-blink-features=AutomationControlled, which makes navigator.webdriver false.

### Features

* **playground:** say when the browser is driven by automation ([cdd42ce](https://github.com/samuelcsantana/pyxis-sdk/commit/cdd42cee7279dc5b6c3bac531d1441b8e357f9fa))
* **privacy:** stop measuring browsers driven by automation ([9e8f058](https://github.com/samuelcsantana/pyxis-sdk/commit/9e8f058722bdd3ae03cb93ec684c82185aa919a7))


### Documentation

* **adr:** record why browsers driven by automation are not measured ([df05495](https://github.com/samuelcsantana/pyxis-sdk/commit/df054952f18cd395107e80787efdf1b446c590f4))
* **readme:** add pyxis-mcp to the ecosystem table ([470774f](https://github.com/samuelcsantana/pyxis-sdk/commit/470774f998cd2cfdf1438a2a4002d893aba7633c))
* **readme:** link the introduction post ([ff6497c](https://github.com/samuelcsantana/pyxis-sdk/commit/ff6497c5ae8b7796dbd092ac36b9e0a8852cdb41))
* **readme:** say that browsers driven by automation are not measured ([80c76a0](https://github.com/samuelcsantana/pyxis-sdk/commit/80c76a0b63699792e224d09e2acaadd09ec761f1))

## [0.2.1](https://github.com/samuelcsantana/pyxis-sdk/compare/v0.2.0...v0.2.1) (2026-10-11)


### Bug Fixes

* **attribution:** stop treating fbclid as an ad click ([d86c688](https://github.com/samuelcsantana/pyxis-sdk/commit/d86c688f4f153e9efee44a452ba67f0a0c916a47))


### Documentation

* **readme:** say why fbclid is not an ad click id ([eaff961](https://github.com/samuelcsantana/pyxis-sdk/commit/eaff961f580c916608d278b42e1b74c491ff86a2))
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
