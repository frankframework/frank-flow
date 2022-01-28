## [2.7.1](https://github.com/ibissource/frank-flow/compare/v2.7.0...v2.7.1) (2022-01-28)


### 🐛 Bug Fixes

* add path to non removable attributes ([c48314c](https://github.com/ibissource/frank-flow/commit/c48314c92a32ce709072a82cf226068ba75f65a7))
* remove delete button for attributes that can't be removed ([68a8ff7](https://github.com/ibissource/frank-flow/commit/68a8ff7cb28de8b9aceac662a79ac76ecc59b953))

# [2.7.0](https://github.com/ibissource/frank-flow/compare/v2.6.3...v2.7.0) (2022-01-28)


### ✨ Features

* remove all forwards pointing to a node when it gets deleted ([00c0b0d](https://github.com/ibissource/frank-flow/commit/00c0b0dc5a784a93d0d79207735bbdbf2642cc0d))
* remove firstpipe if the same node gets removed ([87643a4](https://github.com/ibissource/frank-flow/commit/87643a490b707785077557fde163261bc61511f9))


### 🐛 Bug Fixes

* change forwards to the new name of a node when it is changed ([3bcb596](https://github.com/ibissource/frank-flow/commit/3bcb596486acf7a989406c6badf48fb5bc0906fa))
* moving a forward will change the target of an existing forward ([f636223](https://github.com/ibissource/frank-flow/commit/f63622300e5c1752e81e549ddd6a7e9b4805a790))
* moving the listener to another pipe ([89d3384](https://github.com/ibissource/frank-flow/commit/89d3384d68c5e4dda345b281d5ccca5c125bff12))

## [2.6.3](https://github.com/ibissource/frank-flow/compare/v2.6.2...v2.6.3) (2022-01-27)


### 🛠 Builds

* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([a578c05](https://github.com/ibissource/frank-flow/commit/a578c052bca7b4fc6ad589d4c86b0d4035e40e4b))

## [2.6.2](https://github.com/ibissource/frank-flow/compare/v2.6.1...v2.6.2) (2022-01-27)


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([b6c0f42](https://github.com/ibissource/frank-flow/commit/b6c0f42aaff85e97b9b1ffb8a9eac7d195db87f7))
* **deps:** bump jqwidgets-ng in /frank-flow/src/frontend ([86f35f3](https://github.com/ibissource/frank-flow/commit/86f35f310b8fad84d56052a2325dca6f5351b2a1))

## [2.6.1](https://github.com/ibissource/frank-flow/compare/v2.6.0...v2.6.1) (2022-01-26)


### 🛠 Builds

* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([72c1095](https://github.com/ibissource/frank-flow/commit/72c109527e5836afb99260a8ac055a72e4ee9b2c))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([57d104c](https://github.com/ibissource/frank-flow/commit/57d104cebceafd1b5e453340522a87ef3748cda2))

# [2.6.0](https://github.com/ibissource/frank-flow/compare/v2.5.10...v2.6.0) (2022-01-25)


### ✨ Features

* allways select the current file in the file-tree ([e617830](https://github.com/ibissource/frank-flow/commit/e617830afb27c4cdf2521d094a2392eee99f514f))
* expand folder in which selected item is located ([7774681](https://github.com/ibissource/frank-flow/commit/7774681559f03eb29a3fa5d22aa10a4e47c7141f))


### 🐛 Bug Fixes

* changes after view has been checked error ([2cdf2ce](https://github.com/ibissource/frank-flow/commit/2cdf2ce443d4a4d506e799b7f278c8fdaaae9e90))
* don't do anything if selected file is reselected ([fdb8a15](https://github.com/ibissource/frank-flow/commit/fdb8a15bae7ed3e17bc634fbf944dc76ff92b61c))
* remove code that can done otherwise ([cf495eb](https://github.com/ibissource/frank-flow/commit/cf495ebd95fa9065bc7b8b495ee443c6f52c2987))

## [2.5.10](https://github.com/ibissource/frank-flow/compare/v2.5.9...v2.5.10) (2022-01-25)


### 🐛 Bug Fixes

* remove center canvas button which caused unpredictable behavior ([e6bf7ce](https://github.com/ibissource/frank-flow/commit/e6bf7ce89aaf92e8a9e532fa1526ce1ab5fffb6a))


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([628744e](https://github.com/ibissource/frank-flow/commit/628744e9f88e50b7c68bb84dd31264104352a662))
* **deps-dev:** bump karma in /frank-flow/src/frontend ([4dcaf42](https://github.com/ibissource/frank-flow/commit/4dcaf4255c6da2d3568c7b9c0a3e77f049633fe3))

## [2.5.9](https://github.com/ibissource/frank-flow/compare/v2.5.8...v2.5.9) (2022-01-23)


### 🛠 Builds

* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([9760343](https://github.com/ibissource/frank-flow/commit/97603438f8b6b3aea56c66902977593d64b91351))

## [2.5.8](https://github.com/ibissource/frank-flow/compare/v2.5.7...v2.5.8) (2022-01-23)


### 🛠 Builds

* **deps:** bump tomcat.version from 9.0.48 to 9.0.58 ([cfe4c53](https://github.com/ibissource/frank-flow/commit/cfe4c5369895282bb3e7d1ed3d7e1fa834611441))


### ♻️ Chores

* remove explicit submodules from dependabot, they'll get scanned anyway ([48dbb1f](https://github.com/ibissource/frank-flow/commit/48dbb1f7fcefb0a76c0fd2086ece97adbda7f128))

## [2.5.7](https://github.com/ibissource/frank-flow/compare/v2.5.6...v2.5.7) (2022-01-22)


### 🛠 Builds

* **deps:** bump nanoid in /frank-flow/src/frontend ([ca21ebe](https://github.com/ibissource/frank-flow/commit/ca21ebec3be0a708e54177bb9a7d75ec558a25ec))

## [2.5.6](https://github.com/ibissource/frank-flow/compare/v2.5.5...v2.5.6) (2022-01-21)


### 🛠 Builds

* **deps:** bump log4js from 6.3.0 to 6.4.0 in /frank-flow/src/frontend ([bda283d](https://github.com/ibissource/frank-flow/commit/bda283d5f43299195eae7c3ee8916468cd85180c))

## [2.5.5](https://github.com/ibissource/frank-flow/compare/v2.5.4...v2.5.5) (2022-01-21)


### 🛠 Builds

* **deps-dev:** bump typescript in /frank-flow/src/frontend ([958575f](https://github.com/ibissource/frank-flow/commit/958575fc51eb4028a075520df6c80425995995c1))

## [2.5.4](https://github.com/ibissource/frank-flow/compare/v2.5.3...v2.5.4) (2022-01-20)


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([617b092](https://github.com/ibissource/frank-flow/commit/617b0927e6ada477e4576ffd3163fae84c142026))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([2c30552](https://github.com/ibissource/frank-flow/commit/2c30552322dc60c2434af792e958d306da04096e))

## [2.5.3](https://github.com/ibissource/frank-flow/compare/v2.5.2...v2.5.3) (2022-01-20)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/cytoscape in /frank-flow/src/frontend ([c9edb42](https://github.com/ibissource/frank-flow/commit/c9edb42a983b0195dfd8e56bcf46abc79b0e3c58))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([be79a25](https://github.com/ibissource/frank-flow/commit/be79a2504ba28d6a77fc238a840a6ff7dac40622))

## [2.5.2](https://github.com/ibissource/frank-flow/compare/v2.5.1...v2.5.2) (2022-01-20)


### 🛠 Builds

* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/cli in /frank-flow/src/frontend ([3f00934](https://github.com/ibissource/frank-flow/commit/3f00934ea5add9de6d57ad51cc018f6eb05e0e9d))

## [2.5.1](https://github.com/ibissource/frank-flow/compare/v2.5.0...v2.5.1) (2022-01-20)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([a3766f7](https://github.com/ibissource/frank-flow/commit/a3766f780471dd0d35d1acbfe85d46a6b9f45154))

# [2.5.0](https://github.com/ibissource/frank-flow/compare/v2.4.2...v2.5.0) (2022-01-20)


### ✨ Features

* add setting for the warning for unsaved changes ([a6d4df9](https://github.com/ibissource/frank-flow/commit/a6d4df98289f23065f74277ace55a30e0dcaab64))
* add warning when closing tab while having unsaved changes ([94f363c](https://github.com/ibissource/frank-flow/commit/94f363c107a236a4cde3b61e45858aa0af6c2891))


### 🛠 Builds

* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/cli in /frank-flow/src/frontend ([8207c94](https://github.com/ibissource/frank-flow/commit/8207c94d765468e9b9f0a963cb294922544894db))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([c84b9bd](https://github.com/ibissource/frank-flow/commit/c84b9bd77a3a51cd2643ffcf832fd4acdb5fa257))


### ♻️ Chores

* change lint stage config to not use npx anymore ([d151e3c](https://github.com/ibissource/frank-flow/commit/d151e3c45138523ac83e12fc591f707012e518e2))

## [2.4.2](https://github.com/ibissource/frank-flow/compare/v2.4.1...v2.4.2) (2022-01-20)


### 🛠 Builds

* **deps:** update log4j to version 2.17.1 ([4e0fc61](https://github.com/ibissource/frank-flow/commit/4e0fc61e3365d9f0c614c0f50109a46f16faa811))
* **deps:** update spring to 5.3.15 ([4c1b4cf](https://github.com/ibissource/frank-flow/commit/4c1b4cfa9a2258bafcfcb33e33eac4bc979f054d))

## [2.4.1](https://github.com/ibissource/frank-flow/compare/v2.4.0...v2.4.1) (2022-01-18)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([e8d1fc5](https://github.com/ibissource/frank-flow/commit/e8d1fc546fa524887bdde52f1f75d7c51af02cb2))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([0d70944](https://github.com/ibissource/frank-flow/commit/0d70944b704a99e462d2b3f1e1bca87cea44d0b3))

# [2.4.0](https://github.com/ibissource/frank-flow/compare/v2.3.4...v2.4.0) (2022-01-18)


### ✨ Features

* add additional information about the flow settings. ([ac61b97](https://github.com/ibissource/frank-flow/commit/ac61b9778147b1e01d1b7c298aca993865d4d978))
* make the configuration tag look like one ([d4a73ec](https://github.com/ibissource/frank-flow/commit/d4a73ec8a0a1acb69175382d112cec0fbf194de0))


### 🐛 Bug Fixes

* add a missing hyphen ([c5cda4f](https://github.com/ibissource/frank-flow/commit/c5cda4f49c1b094d81da42b6b481f31c69b13add))
* typo in readme ([5ad0dd6](https://github.com/ibissource/frank-flow/commit/5ad0dd6982103ac23bb8a3784bab7655c0bb31bb))


### 📚 Documentation

* **readme:** add Configuration Flow Settings ([e7ffb3e](https://github.com/ibissource/frank-flow/commit/e7ffb3ef1cd07c6daacc549a023bc5bff3da5dce))
* **readme:** process feedback for better sentences, grammer and content ([06a7a13](https://github.com/ibissource/frank-flow/commit/06a7a1379790fd97ae1b699d9a4d570d3565a977))
* **readme:** update features, insctructions and remove outdated information ([f84ffa5](https://github.com/ibissource/frank-flow/commit/f84ffa5638994910612142bdd6dd51583f5d577a))

## [2.3.4](https://github.com/ibissource/frank-flow/compare/v2.3.3...v2.3.4) (2022-01-17)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([72541e9](https://github.com/ibissource/frank-flow/commit/72541e9d6349342a1b3196c45244e86ffd64a5b3))
* **deps-dev:** bump eslint-plugin-unicorn in /frank-flow/src/frontend ([ef9cf1a](https://github.com/ibissource/frank-flow/commit/ef9cf1ad858eb33b035edc797587571bd87a57ef))

## [2.3.3](https://github.com/ibissource/frank-flow/compare/v2.3.2...v2.3.3) (2022-01-17)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([4227f2d](https://github.com/ibissource/frank-flow/commit/4227f2dea18df2aa81883a4692a9f9493454cf69))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([406e042](https://github.com/ibissource/frank-flow/commit/406e042194c7aa5fc13d923819a810bfb68eaac1))

## [2.3.2](https://github.com/ibissource/frank-flow/compare/v2.3.1...v2.3.2) (2022-01-13)


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([2e6456d](https://github.com/ibissource/frank-flow/commit/2e6456d716f6841b98730eca9cf670400477978a))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([9b394fc](https://github.com/ibissource/frank-flow/commit/9b394fcba7693c1e77132f317fad2614de761bb8))
* **deps-dev:** bump karma in /frank-flow/src/frontend ([bc993f4](https://github.com/ibissource/frank-flow/commit/bc993f494f9b4dc8bd6968083cfcdeb120174628))

## [2.3.1](https://github.com/ibissource/frank-flow/compare/v2.3.0...v2.3.1) (2022-01-13)


### 🛠 Builds

* **deps:** bump engine.io in /frank-flow/src/frontend ([f304e76](https://github.com/ibissource/frank-flow/commit/f304e76725b031cb77e94dd712d2fa663e3bb422))
* **deps:** bump follow-redirects in /frank-flow/src/frontend ([5ceb731](https://github.com/ibissource/frank-flow/commit/5ceb73145849c13e2fc06d4e11270fa2f584c115))

# [2.3.0](https://github.com/ibissource/frank-flow/compare/v2.2.3...v2.3.0) (2022-01-13)


### ✨ Features

* add descriptions to the labels and options in the Settings ([93aadb0](https://github.com/ibissource/frank-flow/commit/93aadb0594a7738e309c6728f1aa6e8ccc0d6f70))
* add hover text to Explorer toggle ([c673689](https://github.com/ibissource/frank-flow/commit/c6736890633f1ff0a778aa0f57903ab8c69693ed))
* add hover text to Toggle component ([6991fb2](https://github.com/ibissource/frank-flow/commit/6991fb23304a23beb2a6bd787e47c70afeb2a54f))


### 🐛 Bug Fixes

* close Options after a Node had been deleted ([3dca833](https://github.com/ibissource/frank-flow/commit/3dca833351107a8fe17e6a97f94d8e8e6f02a250))


### 📦 Code Refactoring

* move the floating actions into it's own component ([3cda8c7](https://github.com/ibissource/frank-flow/commit/3cda8c7cc6f3eef13f3916c87ec59564bf91a20f))

## [2.2.3](https://github.com/ibissource/frank-flow/compare/v2.2.2...v2.2.3) (2022-01-12)


### 🛠 Builds

* **deps:** bump maven-compiler-plugin from 3.8.1 to 3.9.0 ([01e4c36](https://github.com/ibissource/frank-flow/commit/01e4c363f17060b134cbc6aa020a84a695f61cf2))

## [2.2.2](https://github.com/ibissource/frank-flow/compare/v2.2.1...v2.2.2) (2022-01-12)


### 🛠 Builds

* **deps:** bump maven-jar-plugin from 3.2.1 to 3.2.2 ([f589138](https://github.com/ibissource/frank-flow/commit/f589138c95f2e7ab7c03f19aeeaf09fc1c0aa34a))

## [2.2.1](https://github.com/ibissource/frank-flow/compare/v2.2.0...v2.2.1) (2022-01-11)


### 🛠 Builds

* **deps:** bump rxjs from 7.5.1 to 7.5.2 in /frank-flow/src/frontend ([f315af8](https://github.com/ibissource/frank-flow/commit/f315af85ca7fe9a1424f4db8b13bc64574aaee2c))

# [2.2.0](https://github.com/ibissource/frank-flow/compare/v2.1.9...v2.2.0) (2022-01-11)


### ✨ Features

* always show and explorer ([af6f018](https://github.com/ibissource/frank-flow/commit/af6f018e1ac0bad087adf8d5626c40a86afa69ba))
* make Explorer collapsable ([6911d00](https://github.com/ibissource/frank-flow/commit/6911d009f3ef8ba74152a3c552af6033bc47c9ee))
* remove Selector and restyle Header ([e07105e](https://github.com/ibissource/frank-flow/commit/e07105eb6212f2da0ff4dc17a46b00e9e656177d))


### 🐛 Bug Fixes

* make delete button in edit-modal big again ([004b925](https://github.com/ibissource/frank-flow/commit/004b92557096df9334f65f1ff157be0d25115193))


### 📦 Code Refactoring

* move explorer out of the editor component ([607ee19](https://github.com/ibissource/frank-flow/commit/607ee19cdb08c0c0208345dce88add82b38a81e4))


### ♻️ Chores

* change kodiak merge stratagy to rebase ([21a3259](https://github.com/ibissource/frank-flow/commit/21a32594c1c8ca196f7e068d9566d7aad8a0b94b))

## [2.1.9](https://github.com/ibissource/frank-flow/compare/v2.1.8...v2.1.9) (2022-01-11)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([#423](https://github.com/ibissource/frank-flow/issues/423)) ([32a8a02](https://github.com/ibissource/frank-flow/commit/32a8a02e7ac7efdb8d2c65deed8cc02a4f468a90))

## [2.1.8](https://github.com/ibissource/frank-flow/compare/v2.1.7...v2.1.8) (2022-01-10)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([#422](https://github.com/ibissource/frank-flow/issues/422)) ([a0e7d52](https://github.com/ibissource/frank-flow/commit/a0e7d52fc357e67f1304d93eb219479b9f813fe4))

## [2.1.7](https://github.com/ibissource/frank-flow/compare/v2.1.6...v2.1.7) (2022-01-10)


### 🛠 Builds

* **deps:** bump maven-assembly-plugin in /frank-flow-launcher ([#413](https://github.com/ibissource/frank-flow/issues/413)) ([6718a1f](https://github.com/ibissource/frank-flow/commit/6718a1f451fedee78de0cc2be38a98824cf3a0fb))
* **deps:** bump maven-jar-plugin from 3.2.0 to 3.2.1 ([#416](https://github.com/ibissource/frank-flow/issues/416)) ([7e0480b](https://github.com/ibissource/frank-flow/commit/7e0480b7a43aab0f167670dcf55dd85908d3224e))

## [2.1.6](https://github.com/ibissource/frank-flow/compare/v2.1.5...v2.1.6) (2022-01-10)


### 🛠 Builds

* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/cli in /frank-flow/src/frontend ([#420](https://github.com/ibissource/frank-flow/issues/420)) ([ce612a7](https://github.com/ibissource/frank-flow/commit/ce612a78713aeaba5f6e0ccf032a3e15ff66be4e))
* **deps-dev:** bump karma in /frank-flow/src/frontend ([#419](https://github.com/ibissource/frank-flow/issues/419)) ([fd4d5c6](https://github.com/ibissource/frank-flow/commit/fd4d5c6f1e6d50479fdc548f8da66d2da5f21a78))


### ♻️ Chores

* change commit messages for dependabot and add all poms ([83d1a07](https://github.com/ibissource/frank-flow/commit/83d1a077d970bf82fd070c39bf10690f543e0f45))
* remove commit message from dependabot ([344f8cc](https://github.com/ibissource/frank-flow/commit/344f8cc9333969ba38a7d9db9ed96c4cc0073d48))

## [2.1.5](https://github.com/ibissource/frank-flow/compare/v2.1.4...v2.1.5) (2022-01-08)


### 🛠 Builds

* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([#411](https://github.com/ibissource/frank-flow/issues/411)) ([8c1ead7](https://github.com/ibissource/frank-flow/commit/8c1ead7756773bd20fb06ff7f005729735a6dc5d))


### ♻️ Chores

* remove personal access token from workflow ([9000f03](https://github.com/ibissource/frank-flow/commit/9000f030ad49c4190b6377c02b8f24570da6d21b))


### 🗑 Reverts

* remove personal access token from workflow ([8fff351](https://github.com/ibissource/frank-flow/commit/8fff351e5ef58c2d2646804d68f74e1705cd5736))

## [2.1.4](https://github.com/ibissource/frank-flow/compare/v2.1.3...v2.1.4) (2022-01-06)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([#409](https://github.com/ibissource/frank-flow/issues/409)) ([ab6d63c](https://github.com/ibissource/frank-flow/commit/ab6d63ca77ee019631b1ad71a69b211647315fd3))


### ♻️ Chores

* change installation in workflow ([ef5efaa](https://github.com/ibissource/frank-flow/commit/ef5efaa79eb0c3c2f126d01171ec2e7bf9eac813))
* change the conventional changelog preset to metahub and add github release ([ffb0a44](https://github.com/ibissource/frank-flow/commit/ffb0a440fbb9bd172d7aeb2e75417aebea02197f))
* **release:** 2.1.4 [skip ci] ([41117bb](https://github.com/ibissource/frank-flow/commit/41117bb64056834542676a199b2d6691d21de25f))
