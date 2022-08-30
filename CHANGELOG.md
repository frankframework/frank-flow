# [2.26.0](https://github.com/ibissource/frank-flow/compare/v2.25.0...v2.26.0) (2022-08-30)


### ✨ Features

* add better example configurations ([0751c37](https://github.com/ibissource/frank-flow/commit/0751c37bb0108997e92ed4d879f6255e0428872d))
* change docker compose file to include parameters and simplefy database ([0d1fdbf](https://github.com/ibissource/frank-flow/commit/0d1fdbfc207b652a26a963fd1f012d3b818fdf79))
* create Docker image for usage in CI and revert compose file ([f39e13c](https://github.com/ibissource/frank-flow/commit/f39e13c6f41c317e6f3ad26860af50bed5cc13ca))
* give the error from the backend to the user, it contains more info ([62bbcbf](https://github.com/ibissource/frank-flow/commit/62bbcbfa622730caedd38fc137ca05814d9dda79))
* make frank configuration for demo read only ([9bb56a5](https://github.com/ibissource/frank-flow/commit/9bb56a55ef8947e3cd538782abb16b954931cab7))
* run the demo in read-only mode ([9736252](https://github.com/ibissource/frank-flow/commit/9736252e4a5afb177f6a2a16a9830a665f8d1867))


### 🐛 Bug Fixes

* changes for PR 989 ([b73abda](https://github.com/ibissource/frank-flow/commit/b73abda5bd405e525710fcab3f10a698d7628fe8))
* description in options modal can now scroll on the x axis ([66d9b6b](https://github.com/ibissource/frank-flow/commit/66d9b6b31bc5388a549526e840accc67dc468810))
* give the right error when a file cant be found or cand be read, also reset current file ([ce7e4bd](https://github.com/ibissource/frank-flow/commit/ce7e4bd98469d2018ae6c0fb111094fb7181087f))
* make basehref relative ([b4e6413](https://github.com/ibissource/frank-flow/commit/b4e6413da9db981311052d3a70958be7e65b0065))
* make url's relative ([cbb2343](https://github.com/ibissource/frank-flow/commit/cbb234377e093ad26fd6210820f099a98fd9d25f))
* options and modal title wordwrap and width ([01d6203](https://github.com/ibissource/frank-flow/commit/01d62037d98f72593108b460ab008d97487254ea))
* removing a directory will remove the previously selected configuration ([daca49a](https://github.com/ibissource/frank-flow/commit/daca49a0ad87c7a31067c601d59bc54934ca3612))
* revert some changes and move save on enter ([7d15b4f](https://github.com/ibissource/frank-flow/commit/7d15b4fd4b98d14896eddc7ac0fe402f21ee82df))
* saving name twice broke the flow ([185aa2b](https://github.com/ibissource/frank-flow/commit/185aa2b5917ab91a2ca8d7722b548624f4b84cad))
* switch file after auto save ([0e738ba](https://github.com/ibissource/frank-flow/commit/0e738ba3f20fe606c5a670aea116b8aa86b57578))


### 🛠 Builds

* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/builder ([73ef49e](https://github.com/ibissource/frank-flow/commit/73ef49e966f95c38dc6cc026745877d5dfc5e1ea))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/eslint-plugin ([46d550a](https://github.com/ibissource/frank-flow/commit/46d550adcc47b0434174696ffe0cb1be82953cd1))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/schematics ([cd2d40f](https://github.com/ibissource/frank-flow/commit/cd2d40f6543d1480ca07d0f6cf7e10315a27aff5))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/template-parser ([ed30571](https://github.com/ibissource/frank-flow/commit/ed3057196f2c0020d912b3cc9eb5a8d8da2796d8))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([d51fe69](https://github.com/ibissource/frank-flow/commit/d51fe69dc3bc3a8d3eb6b617cd7e4085fa82766c))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([5bb4616](https://github.com/ibissource/frank-flow/commit/5bb461692033284a226934c751788f3665beab02))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([13b50dc](https://github.com/ibissource/frank-flow/commit/13b50dc533f347664c67bf24967ca174d2a6b1eb))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([a438867](https://github.com/ibissource/frank-flow/commit/a438867c6a0677d5235b30f473d65439e131aeaa))
* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/cli in /frank-flow/src/frontend ([4fc74be](https://github.com/ibissource/frank-flow/commit/4fc74bebfaf89b9c4f214229a98b0963431aab7c))
* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/config-conventional ([dfd9bd4](https://github.com/ibissource/frank-flow/commit/dfd9bd49c49172aeb14dfd9d2acda96b4512d7ec))
* **deps-dev:** bump [@types](https://github.com/types)/jasmine in /frank-flow/src/frontend ([5c02dbe](https://github.com/ibissource/frank-flow/commit/5c02dbec9c0ed3c2ba87e3559fff56b9bfbdc7b6))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([1c925a8](https://github.com/ibissource/frank-flow/commit/1c925a83c713dabc9e675078505adeb2934fa01c))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([110dafb](https://github.com/ibissource/frank-flow/commit/110dafb851165a9a386f09fc0ec0dc960459d7fc))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([e1cef78](https://github.com/ibissource/frank-flow/commit/e1cef78026b2f66a24af070c3a80ddc9191309b6))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([8280bd7](https://github.com/ibissource/frank-flow/commit/8280bd701b45c34f787fe68da910ebc1298f01e0))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([1352fa0](https://github.com/ibissource/frank-flow/commit/1352fa00b2a7cf4567ea9c8f4c652a2467d63c29))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([ee1386a](https://github.com/ibissource/frank-flow/commit/ee1386a7fbc06d34f70c54405d09b8d5defeea12))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([b8e9500](https://github.com/ibissource/frank-flow/commit/b8e95008c96dafa64b7b452e4a763c29fc770015))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([2c24114](https://github.com/ibissource/frank-flow/commit/2c2411441983171c63b45e0eeb642484d18d4679))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([433ce97](https://github.com/ibissource/frank-flow/commit/433ce97ab2488c3df18ad00837448700cb7b7df1))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([0c13ab6](https://github.com/ibissource/frank-flow/commit/0c13ab64bc522dab5d543a3e5a996a01d0fbd1df))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([4c33012](https://github.com/ibissource/frank-flow/commit/4c33012bfbff884cd2a6b729f5cb940177a846cf))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([ce5f222](https://github.com/ibissource/frank-flow/commit/ce5f22296317a34a7981f035c833245c1c6f7d4d))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([6f4138f](https://github.com/ibissource/frank-flow/commit/6f4138fda7c6203c7ad35451d230cd027735efea))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([dd41e27](https://github.com/ibissource/frank-flow/commit/dd41e273ed492ab11ea52512ddf0fa3b2d1cd04b))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([c5e309e](https://github.com/ibissource/frank-flow/commit/c5e309e4a82096444c7b701ad999b075c8bb166b))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([77e8452](https://github.com/ibissource/frank-flow/commit/77e8452202647527e9578fd76a5233d91d4f728c))
* **deps-dev:** bump webpack-bundle-analyzer ([05aecd2](https://github.com/ibissource/frank-flow/commit/05aecd25e8912ea2a6ef50a73e8990aabb743551))
* **deps-dev:** bump webpack-bundle-analyzer ([d9e4375](https://github.com/ibissource/frank-flow/commit/d9e43752c4eabcc5635dc4ed33795947f1d1da76))
* **deps:** bump cxf-rt-rs-client from 3.4.7 to 3.5.3 ([26b012d](https://github.com/ibissource/frank-flow/commit/26b012df8209a9d9aa9e328e8ccc095501190878))
* **deps:** bump log4j2.version from 2.17.2 to 2.18.0 ([0e5fa84](https://github.com/ibissource/frank-flow/commit/0e5fa843585fe79ae4ae4cc3a9fe01799275ce32))
* **deps:** bump maven-assembly-plugin from 3.3.0 to 3.4.2 ([645775d](https://github.com/ibissource/frank-flow/commit/645775d3dc01d8304cc88e8501d2e4e235d3c35f))
* **deps:** bump maven-deploy-plugin from 2.8.2 to 3.0.0 ([c42c4d8](https://github.com/ibissource/frank-flow/commit/c42c4d83463a2c015d888f1c7bb06cb3b18396ff))
* **deps:** bump maven-site-plugin from 3.12.0 to 3.12.1 ([0003db3](https://github.com/ibissource/frank-flow/commit/0003db3ef41733bf95179a7546e2fcd139891978))
* **deps:** bump spring-core from 5.3.18 to 5.3.20 in /frank-flow ([2ac74f3](https://github.com/ibissource/frank-flow/commit/2ac74f3923a1a54628511f750df8d08f5cbbf3f3))
* **deps:** bump spring.version from 5.3.18 to 5.3.22 ([cff2bab](https://github.com/ibissource/frank-flow/commit/cff2bab6117a34edd56ee69c3997d4bd35ed7d7c))
* **deps:** bump tomcat.version from 9.0.62 to 9.0.65 ([955ea3f](https://github.com/ibissource/frank-flow/commit/955ea3f05932949407bcef25b89d35a4b1c7d32f))
* **deps:** bump zone.js in /frank-flow/src/frontend ([9709322](https://github.com/ibissource/frank-flow/commit/9709322132e27a1e921181d9a1e8053fcae8a2ae))


### 🚨 Tests

* change default configurations and fix canvas test ([0a9ceda](https://github.com/ibissource/frank-flow/commit/0a9ceda0aca750166b3465a8fa4e593645536064))
* change the tests and move some parts for relevance ([859c4c4](https://github.com/ibissource/frank-flow/commit/859c4c4a73c5e2a40eef0dcb28a2fc6cd1fcda42))
* move relevant code into different tests ([8573e19](https://github.com/ibissource/frank-flow/commit/8573e193a66fcefd310fa4d116baefa8b47dbb5b))


### 🗑 Reverts

* exception didn't work ([e5c17e8](https://github.com/ibissource/frank-flow/commit/e5c17e886cbfb059ad2de76189f663edf1b2db72))

# [2.25.0](https://github.com/ibissource/frank-flow/compare/v2.24.0...v2.25.0) (2022-08-10)


### ✨ Features

* add CI based on Docker ([e086fc3](https://github.com/ibissource/frank-flow/commit/e086fc3d3263d0f10cb75630f9f4c590270162e7))
* add code completion based on json ([fa4afb0](https://github.com/ibissource/frank-flow/commit/fa4afb073287356dd330ca7fb3207c0bebc9bc9f))
* add docker compose for development and change version ([8ae6b39](https://github.com/ibissource/frank-flow/commit/8ae6b396f52f543a7c2b4884c7b3b6c88398e84a))
* add semi-advanced code complition for Frank configurations ([797ee74](https://github.com/ibissource/frank-flow/commit/797ee740152f60dd8a4053b4d48e38f2f127ad86))
* add turndown and fix some angular configuarions ([9b369e6](https://github.com/ibissource/frank-flow/commit/9b369e69b9cff7134c74fa2cd471dd21475522c9))


### 🐛 Bug Fixes

* attribute completion on next line ([34001ce](https://github.com/ibissource/frank-flow/commit/34001cea1f56475aec4548b8c071eefef6751458))
* fix explicit forward to implicit exit ([904bd2c](https://github.com/ibissource/frank-flow/commit/904bd2c8a18c015494f06ee09c7ce3520718a538))
* implicit first pipe shows solid connection to next node ([7d38c02](https://github.com/ibissource/frank-flow/commit/7d38c0241eb9dc3ba7c2ce75f6a368ae5150ab48))
* remove lint disable comments and cleanup code ([e5ffefb](https://github.com/ibissource/frank-flow/commit/e5ffefb0615be5038e37c0a359c97281634033f8))


### 🛠 Builds

* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/builder ([7683f61](https://github.com/ibissource/frank-flow/commit/7683f61cb682a46db72cf1e65d085b5f6271faae))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/builder ([5a2df34](https://github.com/ibissource/frank-flow/commit/5a2df347bc9b61e8de1ecc79ecbbdea82c87dd9b))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/builder ([3a2a57f](https://github.com/ibissource/frank-flow/commit/3a2a57f49f08e5239fa4d4fc9575baaead74882a))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/eslint-plugin ([f71f102](https://github.com/ibissource/frank-flow/commit/f71f102bb69c70fa38252c55134914aea494ef23))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/eslint-plugin-template ([32eac47](https://github.com/ibissource/frank-flow/commit/32eac4742396896f95c9f1bc7ea5a25963306e5f))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/schematics ([729fb42](https://github.com/ibissource/frank-flow/commit/729fb42e8050caf71ba0c6780b443b4326aac789))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/schematics ([03647b0](https://github.com/ibissource/frank-flow/commit/03647b04a5754f6f708476285c8d7fb5f2605aef))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/template-parser ([c2c82d9](https://github.com/ibissource/frank-flow/commit/c2c82d92365338318aca0cba1433aa4e31c35523))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/template-parser ([741c621](https://github.com/ibissource/frank-flow/commit/741c621ab3f2ff0db5ec518c7a55ef27d2f8fbc6))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/template-parser ([c3ab69c](https://github.com/ibissource/frank-flow/commit/c3ab69c6c7786f747c12f268fd44d095ef904587))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli and [@angular-eslint](https://github.com/angular-eslint)/schematics ([75cde36](https://github.com/ibissource/frank-flow/commit/75cde3689393aab1a110938d4057f5cd9a050a9f))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([3afe69b](https://github.com/ibissource/frank-flow/commit/3afe69b8b1133b1c994533ee96b94d8c37147a06))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([dcc8c26](https://github.com/ibissource/frank-flow/commit/dcc8c26b9f3899c680d80f481710f971ac42a365))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([c38a067](https://github.com/ibissource/frank-flow/commit/c38a06740fdfc34cc969ce0bee8cd2d59ae32fe4))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([6a7c50a](https://github.com/ibissource/frank-flow/commit/6a7c50a235d9e3f24a9ad1be13b1642a3d66a47b))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([b09d94f](https://github.com/ibissource/frank-flow/commit/b09d94fa839dca2a60ef0f2ccbbecffb09874956))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([be6a99f](https://github.com/ibissource/frank-flow/commit/be6a99f51fe50436a67c6b6e2fdc6855e057673c))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([d281755](https://github.com/ibissource/frank-flow/commit/d281755a9761a7dee71657c87b99dd316f4e2180))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([5a29df0](https://github.com/ibissource/frank-flow/commit/5a29df01a84ec9f28560fb73bc370cb39b686eae))
* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/cli in /frank-flow/src/frontend ([2255a7f](https://github.com/ibissource/frank-flow/commit/2255a7f9fae0b8e724caaf96fac991cde6187f5d))
* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/config-conventional ([750b33f](https://github.com/ibissource/frank-flow/commit/750b33fecdf566f2c04d77bf7ddffdfbbaae5486))
* **deps-dev:** bump [@types](https://github.com/types)/cytoscape in /frank-flow/src/frontend ([eb304f7](https://github.com/ibissource/frank-flow/commit/eb304f7e5e2976a77fee1beb64b56a1c28d038cc))
* **deps-dev:** bump [@types](https://github.com/types)/cytoscape in /frank-flow/src/frontend ([ad7ac3f](https://github.com/ibissource/frank-flow/commit/ad7ac3f3320e84ede2b9c618d940c067c0b4fd9d))
* **deps-dev:** bump [@types](https://github.com/types)/cytoscape in /frank-flow/src/frontend ([6e1f37c](https://github.com/ibissource/frank-flow/commit/6e1f37c2ab165e05bc27960ba2944ead0a0e80b0))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([fdcc2e5](https://github.com/ibissource/frank-flow/commit/fdcc2e551c4e724391521d7a6f0d40044c33f1ac))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([7823cec](https://github.com/ibissource/frank-flow/commit/7823cece1c3f95128c256ba354795895ffe42ec4))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([b165518](https://github.com/ibissource/frank-flow/commit/b1655189623d6cb91a09b419b19d249c6a83b076))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([a7e53f4](https://github.com/ibissource/frank-flow/commit/a7e53f49913a1ed0933459f21da01a4c01b11dcf))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([f2fba16](https://github.com/ibissource/frank-flow/commit/f2fba169b2653c45edb65b6d64eaf4120d3a3714))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([5c43420](https://github.com/ibissource/frank-flow/commit/5c4342097ca2ddd8202388797dbdc9d5604732b9))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([c2b42b8](https://github.com/ibissource/frank-flow/commit/c2b42b84babea8d4196d47a2bc25eb709e349cfc))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([e3321be](https://github.com/ibissource/frank-flow/commit/e3321bed2caf77ed8f144bad731c0ffd9c3f2edd))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([591440a](https://github.com/ibissource/frank-flow/commit/591440a6bac07c2a965b4b289bd1ab1a658b95d2))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([df2600e](https://github.com/ibissource/frank-flow/commit/df2600ebfb35cd8d4afe047c16b637e616e48545))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([6ecb2a7](https://github.com/ibissource/frank-flow/commit/6ecb2a7b2aac9597e604a786d9817a03dc242822))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([60e589e](https://github.com/ibissource/frank-flow/commit/60e589ed7b56fe7d578b9d4062073396dea828dc))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([2805c68](https://github.com/ibissource/frank-flow/commit/2805c68cf11c4e529d16cdb191a3c3b979b1f27a))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([0e5c70c](https://github.com/ibissource/frank-flow/commit/0e5c70c3293c85c1f8846ecf8ca2dd913327a5dc))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([4d518d3](https://github.com/ibissource/frank-flow/commit/4d518d33f9ba7f4e83daa6d1edbe17e6f01c7720))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([704a0f6](https://github.com/ibissource/frank-flow/commit/704a0f618ca9a54a0b44f972af37f67b47da94ed))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([e44f53b](https://github.com/ibissource/frank-flow/commit/e44f53b883290759efdc1ab153da72c5de539bd6))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([0c7724e](https://github.com/ibissource/frank-flow/commit/0c7724ebd2d61bc0963f4140e23616a47e576e06))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([7a69781](https://github.com/ibissource/frank-flow/commit/7a697817db3f6d4accb082bae5fd1e7d3fedab6e))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([05852b7](https://github.com/ibissource/frank-flow/commit/05852b7c97aa4204311d40c6287143b099d53142))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([131b81d](https://github.com/ibissource/frank-flow/commit/131b81dc9a2eb1c6cd81a8a0b50d4bd45b4c8b11))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([3bf2d56](https://github.com/ibissource/frank-flow/commit/3bf2d565a9274a17a5f8f4111edf4aaaa2e8ebdd))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([3d2b95b](https://github.com/ibissource/frank-flow/commit/3d2b95b53bdaeefa52bb10f0ae3becb25ff49b16))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([a66e3e1](https://github.com/ibissource/frank-flow/commit/a66e3e13ed29df2d1a5d62d90d52a81363a9ebca))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([2054699](https://github.com/ibissource/frank-flow/commit/205469921c46501563c018efe19ad19b9e0c6c10))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([7a0e8ed](https://github.com/ibissource/frank-flow/commit/7a0e8eda2e3fa1a14d0b8578211a4a6e4305801a))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([fc84a14](https://github.com/ibissource/frank-flow/commit/fc84a14a4bbd7b0100bba272fc476159c36191c7))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([c69a2c2](https://github.com/ibissource/frank-flow/commit/c69a2c29918ddfe53778262f89be79fa0a9da785))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([299c899](https://github.com/ibissource/frank-flow/commit/299c89952f66f1ef222bc4384b68918df9fa6fc3))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([f8972b5](https://github.com/ibissource/frank-flow/commit/f8972b5a4a4c3d6f525aecdb8f0bbfb73e638194))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([a94ceb4](https://github.com/ibissource/frank-flow/commit/a94ceb40eff07036164e39484d3a714148c77336))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([8d007dc](https://github.com/ibissource/frank-flow/commit/8d007dc2150b03f7948f0b7f3eb91c14b903f3b6))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([cbcbbda](https://github.com/ibissource/frank-flow/commit/cbcbbdab84609c49bdd9f6f5febf6ffedf2c1789))
* **deps-dev:** bump eslint-plugin-prettier in /frank-flow/src/frontend ([1d76455](https://github.com/ibissource/frank-flow/commit/1d764553ecb33595c40881288a8de57a9976a54d))
* **deps-dev:** bump eslint-plugin-prettier in /frank-flow/src/frontend ([8fc9ef7](https://github.com/ibissource/frank-flow/commit/8fc9ef7bdbd9cbb3a979bae905f3c793d7d865e1))
* **deps-dev:** bump eslint-plugin-unicorn in /frank-flow/src/frontend ([14cadae](https://github.com/ibissource/frank-flow/commit/14cadaed9aac44958d5e653f364fdcbd4327435a))
* **deps-dev:** bump eslint-plugin-unicorn in /frank-flow/src/frontend ([70225cc](https://github.com/ibissource/frank-flow/commit/70225cccb67f6475be400cac5bcefd695c718530))
* **deps-dev:** bump eslint-plugin-unicorn in /frank-flow/src/frontend ([7462ce7](https://github.com/ibissource/frank-flow/commit/7462ce71277e1cfcba3c9386dc01d3e689a498ac))
* **deps-dev:** bump jasmine-core in /frank-flow/src/frontend ([ed12c87](https://github.com/ibissource/frank-flow/commit/ed12c8730bb3949a406ecdf18b5a629ccd24263e))
* **deps-dev:** bump karma in /frank-flow/src/frontend ([bc6c93d](https://github.com/ibissource/frank-flow/commit/bc6c93d2ee40a7727eaf906005ea188a172e6d4f))
* **deps-dev:** bump karma-jasmine in /frank-flow/src/frontend ([9436df7](https://github.com/ibissource/frank-flow/commit/9436df75c39962b530ab2c4fa1a5108187749559))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([b8533b9](https://github.com/ibissource/frank-flow/commit/b8533b9e92f709edf08bb30bf0a175833a1819d4))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([357bb74](https://github.com/ibissource/frank-flow/commit/357bb747a81487afe25b8783a8179deca086bd09))
* **deps-dev:** bump prettier in /frank-flow/src/frontend ([1c0d7f8](https://github.com/ibissource/frank-flow/commit/1c0d7f8dcf82349e81fb4faa0695f9b9dfbf74ad))
* **deps-dev:** bump prettier in /frank-flow/src/frontend ([7acf6cc](https://github.com/ibissource/frank-flow/commit/7acf6ccda9b70b8bdd5bdfc57e5be5c30af4a6c5))
* **deps-dev:** bump ts-node in /frank-flow/src/frontend ([6fe1f14](https://github.com/ibissource/frank-flow/commit/6fe1f14440d305f9278ae67d783139e16930412e))
* **deps-dev:** bump ts-node in /frank-flow/src/frontend ([e92f935](https://github.com/ibissource/frank-flow/commit/e92f935714a4c6d6e181274b8befdbee2c471e06))
* **deps:** bump [@fortawesome](https://github.com/fortawesome)/free-regular-svg-icons ([62fdccc](https://github.com/ibissource/frank-flow/commit/62fdccc5a2d4e00e4d9067aed067f57444de1f73))
* **deps:** bump cytoscape in /frank-flow/src/frontend ([a72a4d6](https://github.com/ibissource/frank-flow/commit/a72a4d6cfda3481e319814c48fd8c39f7649fba1))
* **deps:** bump cytoscape in /frank-flow/src/frontend ([5d3b333](https://github.com/ibissource/frank-flow/commit/5d3b33328c8560df18059bbef0df32451024394b))
* **deps:** bump cytoscape in /frank-flow/src/frontend ([a1fda44](https://github.com/ibissource/frank-flow/commit/a1fda44ff5c8b4646cc966386960980faa5e7f9d))
* **deps:** bump monaco-editor in /frank-flow/src/frontend ([2cfb731](https://github.com/ibissource/frank-flow/commit/2cfb731423cd2ec54892d226f56fc06e0d8f0101))
* **deps:** bump rxjs from 7.5.5 to 7.5.6 in /frank-flow/src/frontend ([40c7ca3](https://github.com/ibissource/frank-flow/commit/40c7ca3896f195f0afca899cea06079faf5c494c))
* **deps:** bump zone.js in /frank-flow/src/frontend ([d5f5299](https://github.com/ibissource/frank-flow/commit/d5f529941ebe381f4f64bf8079d6a38b082f1a9a))
* **deps:** bump zone.js in /frank-flow/src/frontend ([0ba739d](https://github.com/ibissource/frank-flow/commit/0ba739d3790e0459d93eb3cb752de899bec4c0a0))


### ♻️ Chores

* run the framework with docker in the CI ([5e9d07d](https://github.com/ibissource/frank-flow/commit/5e9d07d788ce7f61aa48686a5104ef33afb7ee69))

# [2.24.0](https://github.com/ibissource/frank-flow/compare/v2.23.3...v2.24.0) (2022-06-14)


### ✨ Features

* ask the user for input when creating forward ([c2e36aa](https://github.com/ibissource/frank-flow/commit/c2e36aaba173b7f00b3feac076c19fe47f2c1c08))


### 🐛 Bug Fixes

* dragging forward to implicit exit breaks flow ([d16698b](https://github.com/ibissource/frank-flow/commit/d16698b31032ef7cca3e6cbb8acd24d4c2f60a69))
* fix pull request comments ([4cf92d1](https://github.com/ibissource/frank-flow/commit/4cf92d1e8a6b02ffb7293460808821101cc1250a))
* remove Frank!Flow dependency from Frank! as it gave problems with the Frank!Runner ([97a40b3](https://github.com/ibissource/frank-flow/commit/97a40b3bf140e024246a89948533e9a353c562e8))
* subelements won't get rendered in the Flow and will update the Flow when added ([d0b0a4f](https://github.com/ibissource/frank-flow/commit/d0b0a4fe1ff69dd63f128830938a95691887b84b))


### 🛠 Builds

* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/builder ([d05234a](https://github.com/ibissource/frank-flow/commit/d05234a3bbefbdd48d15345417269066e7b18dff))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/builder ([533b453](https://github.com/ibissource/frank-flow/commit/533b4534a0443bacc44b4aee599258aa70f11048))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/eslint-plugin ([242ac8e](https://github.com/ibissource/frank-flow/commit/242ac8ef5c2e8f2c370515595a3edf94d7a2a7c1))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/eslint-plugin-template ([dc4fd35](https://github.com/ibissource/frank-flow/commit/dc4fd3582a3b32359a3b0370c96470f7a0e4818c))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/schematics ([c33dce8](https://github.com/ibissource/frank-flow/commit/c33dce89ff98d063d51c4e04ac4ceaf08685307a))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/schematics ([f444b79](https://github.com/ibissource/frank-flow/commit/f444b796b7fec1e86425f64c19ba053ced3fd7b1))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/template-parser ([3953e95](https://github.com/ibissource/frank-flow/commit/3953e95a1e81ebe1dea24f1392e37fb26df0674d))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/template-parser ([0bcecd1](https://github.com/ibissource/frank-flow/commit/0bcecd15587478832278877f2a4677275d5479e1))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([c07e100](https://github.com/ibissource/frank-flow/commit/c07e10045be8f5b6145ff26b4e8f6526952bc143))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([d63f4f0](https://github.com/ibissource/frank-flow/commit/d63f4f08c164368f833447d04db4097f0b1528dd))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([ab16348](https://github.com/ibissource/frank-flow/commit/ab163484c79e03d77cc65ab849dea507fb117643))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([96b5104](https://github.com/ibissource/frank-flow/commit/96b51047add5cf1b1e5fbd01eefa473f07584943))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([7770578](https://github.com/ibissource/frank-flow/commit/7770578caf0c24208b0cac47fe3c0ce000a1c2b6))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([3784b5c](https://github.com/ibissource/frank-flow/commit/3784b5cb58438015afe4dafe4374ff60616d091c))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([5a526d4](https://github.com/ibissource/frank-flow/commit/5a526d46f1a9a61beaecb6a1f0fc8ccd7b1a1cc8))
* **deps-dev:** bump jasmine-core in /frank-flow/src/frontend ([1c1d839](https://github.com/ibissource/frank-flow/commit/1c1d839f02743bbf28c748bb63b514a2788cc96b))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([e4427ae](https://github.com/ibissource/frank-flow/commit/e4427aee7fa6376c6c96784f99b505420079136c))
* **deps-dev:** bump ts-node in /frank-flow/src/frontend ([ceb9400](https://github.com/ibissource/frank-flow/commit/ceb9400aaa2f9235f4365ef3661214501ac41f21))
* **deps:** bump jqwidgets-ng in /frank-flow/src/frontend ([83f574b](https://github.com/ibissource/frank-flow/commit/83f574b68821b0dbd1c52bc590f3f22a7f699e37))
* **deps:** bump jqwidgets-ng in /frank-flow/src/frontend ([402da4a](https://github.com/ibissource/frank-flow/commit/402da4a99b5ba1193c158e4ade7a5d68ae207ce4))

## [2.23.3](https://github.com/ibissource/frank-flow/compare/v2.23.2...v2.23.3) (2022-06-02)


### 🐛 Bug Fixes

* change automatic versioning: change automatic versioning ([9fb1545](https://github.com/ibissource/frank-flow/commit/9fb1545cc411425f385e2a6c8145a020ea603566))

## [2.23.2](https://github.com/ibissource/frank-flow/compare/v2.23.1...v2.23.2) (2022-06-02)


### 🛠 Builds

* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/cli in /frank-flow/src/frontend ([a1c1c24](https://github.com/ibissource/frank-flow/commit/a1c1c2461911a6cd12c57e37058c5b82b861aec9))
* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/config-conventional ([e114476](https://github.com/ibissource/frank-flow/commit/e1144765baf87210b05533ec29a1e2d7455a7f56))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([7644042](https://github.com/ibissource/frank-flow/commit/764404201d7dc83f640ee05be2e96ee38a5b894d))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([e31506f](https://github.com/ibissource/frank-flow/commit/e31506f979e5cf66b3d44107db70e591946d1d02))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([616a1c7](https://github.com/ibissource/frank-flow/commit/616a1c7dab11737f006d71faf70cf0262e4ca822))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([82d1214](https://github.com/ibissource/frank-flow/commit/82d1214ae38bf13411f83095b88817062024923b))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([4046649](https://github.com/ibissource/frank-flow/commit/40466498d9d19be5aa3cc12c71fdafdf882866d2))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([4c013e1](https://github.com/ibissource/frank-flow/commit/4c013e15daddbe8ff90752031750374802df1b08))


### ♻️ Chores

* **ci:** add snapshot release to own workflow ([909f7cd](https://github.com/ibissource/frank-flow/commit/909f7cdf3a1766f5787a8bf6a79c67e5aa73869e))

## [2.23.1](https://github.com/ibissource/frank-flow/compare/v2.23.0...v2.23.1) (2022-05-30)


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([b824fc7](https://github.com/ibissource/frank-flow/commit/b824fc7c93471204d649e0963f3995468c225e22))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([c80d7f3](https://github.com/ibissource/frank-flow/commit/c80d7f3a633d4a8358e5fefa3764243354cc8963))
* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/cli in /frank-flow/src/frontend ([ea2e411](https://github.com/ibissource/frank-flow/commit/ea2e4114493ba8709b2800665c9384fa1876a929))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([4bbc939](https://github.com/ibissource/frank-flow/commit/4bbc9392009861be1a0a78d32d5edd0970e52105))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([d7a7767](https://github.com/ibissource/frank-flow/commit/d7a7767cb552471f9a5d33f8041c826483fe56f8))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([e85e2c3](https://github.com/ibissource/frank-flow/commit/e85e2c33398423122944b371ec8bfd7c308d79e2))
* **deps-dev:** bump karma-jasmine-html-reporter ([d168c75](https://github.com/ibissource/frank-flow/commit/d168c753c66dfc58d976e93206728eb6a1f8da84))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([96a0ba9](https://github.com/ibissource/frank-flow/commit/96a0ba9fdcc6fc52c9df88390db04fa3abcd7e08))
* **deps-dev:** bump ts-node in /frank-flow/src/frontend ([87acfd5](https://github.com/ibissource/frank-flow/commit/87acfd572252891bb01870d6b1e108d2ac8c9e04))
* **deps:** bump jqwidgets-ng in /frank-flow/src/frontend ([1915b34](https://github.com/ibissource/frank-flow/commit/1915b341ee17d354879c0d4b5b3c54706aa8dc06))


### ♻️ Chores

* jenkins build fail ([ee5a6b4](https://github.com/ibissource/frank-flow/commit/ee5a6b4ac667886389e54ec1fabfd39eb2e94a3d))

# [2.23.0](https://github.com/ibissource/frank-flow/compare/v2.22.0...v2.23.0) (2022-05-23)


### ✨ Features

* add badges for the listeners ([70be8ae](https://github.com/ibissource/frank-flow/commit/70be8ae132fd06b09dd2100d8e71ae4615acb70c))
* add exits correctly to configuration when an exit is added ([8fba69d](https://github.com/ibissource/frank-flow/commit/8fba69d91886f869a11f94ec39bba6f3c3a1430f))
* add implicit forwards ([d566f70](https://github.com/ibissource/frank-flow/commit/d566f7091f68359e8baaebb1877875c9d0b15c16))
* add more icons to zoom ([a232091](https://github.com/ibissource/frank-flow/commit/a2320912570624cad97ce5a1bb0e802ba6c15f29))
* add settings to toggle 'show whitespaces' and 'insert spaces instead of tabs' ([2522e60](https://github.com/ibissource/frank-flow/commit/2522e60c21821ee0d81335caa1317599f644de77))
* change zoom buttons to a slider for a better user experience ([6c90a68](https://github.com/ibissource/frank-flow/commit/6c90a68ec0ffa3ec70b4e2c7e31c5823f04b2a2d))
* extend zoomlevels and add new caculation for zoomin in ([be32e56](https://github.com/ibissource/frank-flow/commit/be32e56b761ed527802b0c9c1feef33086f586a2))
* implement implicit exit ([3ad5fed](https://github.com/ibissource/frank-flow/commit/3ad5fed64620129f45acc64fad2f036beb779cce))
* implement Validators, Wrappers and Nested Elements for Sender ([d754ce8](https://github.com/ibissource/frank-flow/commit/d754ce8b6f7a27175c410f1ce81b42eaba4c1a9c))
* remove exit and forward in new configuration template ([965af89](https://github.com/ibissource/frank-flow/commit/965af8952ee0a370d85cdbe4584d11bbd26c42ee))


### 🐛 Bug Fixes

* add exits correctly to Configuration when an exit is added ([24d7daa](https://github.com/ibissource/frank-flow/commit/24d7daa359679c40873fd773a1a476f02399ea0a))
* add PR changes ([d1be679](https://github.com/ibissource/frank-flow/commit/d1be6790950071c80eedc3576c52f34a674ba357))
* bug where flow doesnt trigger right after edding xmlns:flow ([eba27af](https://github.com/ibissource/frank-flow/commit/eba27afdd1cef7f4a3838b73eab699e8f51402dc))
* deleting nodes didn't delete forwards or firstpipe ([5815bac](https://github.com/ibissource/frank-flow/commit/5815bac1b2071dc52412ee6ec7a41a07faca4343))
* insert space when typing tab setting ([afd7730](https://github.com/ibissource/frank-flow/commit/afd7730ae6e7ece8be5f0760d55409b3973e2489))
* parse error when mutiple senders have the same name ([1567e87](https://github.com/ibissource/frank-flow/commit/1567e87119edecb17685e49a19d643c913127825))
* recalculate zoomlevel for jsPlumb ([6e6230a](https://github.com/ibissource/frank-flow/commit/6e6230ad9fdd33929ba2a3685bbf4be9bf2018e8))
* rename configuration settings in code and add trash icon to flow settings ([56a9f62](https://github.com/ibissource/frank-flow/commit/56a9f62f72167965b7e6a97382df39d08daff230))
* reset function coused error when flow wasn't loaded ([e0a0f07](https://github.com/ibissource/frank-flow/commit/e0a0f07b5e5cd5ec91d1ada87c03cec56a67e02c))
* show whitespace off now shows whitespaces in selected code ([22aa11c](https://github.com/ibissource/frank-flow/commit/22aa11cf846816cbcefdfd157d87d7c0d958ff96))
* when file is deleted the frankflow breaks ([ecc9463](https://github.com/ibissource/frank-flow/commit/ecc946376d6ab8b3bd8813226dce7b9b7c7ec6ce))


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([6f64180](https://github.com/ibissource/frank-flow/commit/6f641809544aaac4b8fa1711cf6592e7c35b7718))
* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([843a1c0](https://github.com/ibissource/frank-flow/commit/843a1c03cbed7a86729d89de824ca8431c07ec1b))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([0a54ec6](https://github.com/ibissource/frank-flow/commit/0a54ec6cd0343ebbf2d3303dbcbe3c59e295d626))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([64774b7](https://github.com/ibissource/frank-flow/commit/64774b75f4a00db9cdc2522716257a0ae1c270c9))
* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/cli in /frank-flow/src/frontend ([8eb6d31](https://github.com/ibissource/frank-flow/commit/8eb6d313316e63f315667a64acf404a53f63b91a))
* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/config-conventional ([8645938](https://github.com/ibissource/frank-flow/commit/864593801f5454d5c1762a155707caa8f6575bb7))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([939f54b](https://github.com/ibissource/frank-flow/commit/939f54beb6b3714e866b1b4ff34b564191039a4d))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([3ecf4aa](https://github.com/ibissource/frank-flow/commit/3ecf4aa6b042c93e7ef78286d04ba92a062aa237))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([1192af3](https://github.com/ibissource/frank-flow/commit/1192af3d62b837219800621baa3ef89b770c62b8))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([ae0cf10](https://github.com/ibissource/frank-flow/commit/ae0cf10068d7f0c1830175ed24ba45d7afa0abb3))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([f5d5df2](https://github.com/ibissource/frank-flow/commit/f5d5df21642ae6f56800c06bc46d7a5ecf5c4703))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([1d4669b](https://github.com/ibissource/frank-flow/commit/1d4669b6d4d7da78aab7cb6058ebace05b8e6ba7))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([a9afbd0](https://github.com/ibissource/frank-flow/commit/a9afbd010c45ad959bbc0f9b8021a105b7117217))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([a07edcc](https://github.com/ibissource/frank-flow/commit/a07edcc0206b1b66f4935b93b0fea51770a57e23))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([2f51536](https://github.com/ibissource/frank-flow/commit/2f515361119600fe2a3860eff16391b852985e7b))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([3a81720](https://github.com/ibissource/frank-flow/commit/3a81720cadc02a937a6f5228ae3cd6e3e73211c6))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([2ef158f](https://github.com/ibissource/frank-flow/commit/2ef158ff9c849f42b0d178e467af99525b4a001a))
* **deps-dev:** bump husky in /frank-flow/src/frontend ([2f5e654](https://github.com/ibissource/frank-flow/commit/2f5e654cd5b631fa1248515baa4bf93840d2bd29))
* **deps-dev:** bump jasmine-core in /frank-flow/src/frontend ([ee8d9a7](https://github.com/ibissource/frank-flow/commit/ee8d9a76ce45819c1a615ed69a8eb8addbf016f0))
* **deps-dev:** bump karma in /frank-flow/src/frontend ([20e070b](https://github.com/ibissource/frank-flow/commit/20e070b2e1d350fd959346bee0a7cbb1918d51f7))
* **deps-dev:** bump karma-jasmine in /frank-flow/src/frontend ([83053d3](https://github.com/ibissource/frank-flow/commit/83053d3c84d82764e55092230b85da433ff996cb))
* **deps:** bump async from 2.6.3 to 2.6.4 in /frank-flow/src/frontend ([eb59ec1](https://github.com/ibissource/frank-flow/commit/eb59ec1bdfb032dc6bfa7f884773a7cf781a8812))


### 📦 Code Refactoring

* remove unnecessary senders property on structure nodes ([1da32bd](https://github.com/ibissource/frank-flow/commit/1da32bdea7dfab50e1fbbd07517a3d4730c3a0da))
* small refactor to generate pipline ([93b7b3f](https://github.com/ibissource/frank-flow/commit/93b7b3f42c0f433ed68d144b926e78eaba2d4cf2))


### 📚 Documentation

* **readme:** clarify adding the frank-flow to a frank ([fb83fd6](https://github.com/ibissource/frank-flow/commit/fb83fd6690ff188422c0a8572d42d7720cbab78c))
* **readme:** update readme for latest frankrunner ([dd9a55f](https://github.com/ibissource/frank-flow/commit/dd9a55fe5165bde31d97e6d4bf28e2dedf5c80d3))

# [2.22.0](https://github.com/ibissource/frank-flow/compare/v2.21.0...v2.22.0) (2022-05-05)


### ✨ Features

* show tabs and spaces in the text editor ([1335e0b](https://github.com/ibissource/frank-flow/commit/1335e0b6b7e3367c59bef816c8be7617b3f5af96))


### 🐛 Bug Fixes

* make monaco use tabs instead of spaces ([2d6c59e](https://github.com/ibissource/frank-flow/commit/2d6c59e77520657cdeef324f79de1ab27f99bfe7))
* make node moving consistant ([3e0ecaa](https://github.com/ibissource/frank-flow/commit/3e0ecaae96ad9ec0636497fcfad83978658bbc3c))
* make node name bold ([200e57c](https://github.com/ibissource/frank-flow/commit/200e57c2ad7b6796721e8cf2d54fda07e05716fb))


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([724ccec](https://github.com/ibissource/frank-flow/commit/724ccec3e8bdc34306df03b4fa9a6fe6dc2cadc8))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([5c4409d](https://github.com/ibissource/frank-flow/commit/5c4409dbb96b57cc7095c4ed47e90618ba7a04e8))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([05cf185](https://github.com/ibissource/frank-flow/commit/05cf185cac7e42cec69fa0369743a753817cc08c))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([6b2d8b1](https://github.com/ibissource/frank-flow/commit/6b2d8b10dc105957586e76e288a93e71cd14ac27))
* **deps:** bump jqwidgets-ng in /frank-flow/src/frontend ([07aba0c](https://github.com/ibissource/frank-flow/commit/07aba0cf77c9c3d21f580f19e37be8627ee17f9e))

# [2.21.0](https://github.com/ibissource/frank-flow/compare/v2.20.4...v2.21.0) (2022-04-29)


### ✨ Features

* make palette colapsible ([abdc036](https://github.com/ibissource/frank-flow/commit/abdc036f730f90291fe84e004f6ebb735ebce54f))


### 🐛 Bug Fixes

* hide palette button when editor mode is selected ([1dbbe26](https://github.com/ibissource/frank-flow/commit/1dbbe2606875d0200c36d49b834a698b47e8ed77))
* non-configuration file was classified as empty file ([5d4a171](https://github.com/ibissource/frank-flow/commit/5d4a1717e8c9c7cd79ad0ce8a69950415f13ff0b))


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([41ef37a](https://github.com/ibissource/frank-flow/commit/41ef37a809a795d907183f6031a87acf5b997f94))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([6487b82](https://github.com/ibissource/frank-flow/commit/6487b82fe0f56b4686a70f999ab0f7ea73e3c7da))
* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/cli in /frank-flow/src/frontend ([6e19acb](https://github.com/ibissource/frank-flow/commit/6e19acb7c831b71b013f69e9d42d9f99a8d63914))
* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/config-conventional ([e9b63c3](https://github.com/ibissource/frank-flow/commit/e9b63c3cfe85fa4cc35d3ca2fa52beac3a811efa))

## [2.20.4](https://github.com/ibissource/frank-flow/compare/v2.20.3...v2.20.4) (2022-04-28)


### 🐛 Bug Fixes

* commiting with token ([da537aa](https://github.com/ibissource/frank-flow/commit/da537aa84a1d66df8cab1c8c4d259a8a0e66ba84))
* commiting with token and user ([47ea281](https://github.com/ibissource/frank-flow/commit/47ea281d666db45504e099541c75f3258633eb64))
* commiting with token and user ([213ce62](https://github.com/ibissource/frank-flow/commit/213ce621f78996606cdc1725a3978a4c09778879))


### ♻️ Chores

* add snapshot release to semantic release script ([d9bccd2](https://github.com/ibissource/frank-flow/commit/d9bccd2b24b3335448662f756f7a4690cbeb2b42))
* add token to push ([f4b18c3](https://github.com/ibissource/frank-flow/commit/f4b18c371089848835360956d63867d3f500f467))
* add token to push and set persist-credentials to true ([7dd64cf](https://github.com/ibissource/frank-flow/commit/7dd64cfd443c2584160ef9eb82e6b4dc36010f2e))

## [2.20.3](https://github.com/ibissource/frank-flow/compare/v2.20.2...v2.20.3) (2022-04-28)


### 🐛 Bug Fixes

* issue in ci for making snapshot version ([72e4b40](https://github.com/ibissource/frank-flow/commit/72e4b40ccf66a91296e96d3f8fa55f83e05b613a))

## [2.20.2](https://github.com/ibissource/frank-flow/compare/v2.20.1...v2.20.2) (2022-04-28)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([03471ab](https://github.com/ibissource/frank-flow/commit/03471ab3062a6b4b36cdb17711086393bb58fdaf))
* **deps:** bump ejs from 3.1.6 to 3.1.7 in /frank-flow/src/frontend ([f081656](https://github.com/ibissource/frank-flow/commit/f081656b48de0ea01ed31cbf8aaf214f729f9f31))


### ♻️ Chores

* add action for add and commit ([9718872](https://github.com/ibissource/frank-flow/commit/971887209d19e277c9b1b397d147703e38095183))

## [2.20.1](https://github.com/ibissource/frank-flow/compare/v2.20.0...v2.20.1) (2022-04-27)


### 🐛 Bug Fixes

* commit pom in ci ([fe37294](https://github.com/ibissource/frank-flow/commit/fe37294b3c743545668823185ea8e7e53543f33a))


### ♻️ Chores

* add m2 to cache ([943347c](https://github.com/ibissource/frank-flow/commit/943347cf5dad216987e8eea5d3d44b2e312160a5))

# [2.20.0](https://github.com/ibissource/frank-flow/compare/v2.19.1...v2.20.0) (2022-04-27)


### ✨ Features

* add undo and redo buttons to header ([b2af57d](https://github.com/ibissource/frank-flow/commit/b2af57da9e96409fc4901049ce71a3f95362ce60))


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([219fb51](https://github.com/ibissource/frank-flow/commit/219fb51b764e4c9f6b665a7b0839531c92e1c258))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([c08d2c6](https://github.com/ibissource/frank-flow/commit/c08d2c6756687ef0e305c32412e128dba0d65023))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([cb7f980](https://github.com/ibissource/frank-flow/commit/cb7f98026e8e2ab1e20bcad73356b49c1fe9eaff))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([aace402](https://github.com/ibissource/frank-flow/commit/aace4021da7a081ba0cca342ce9c217f0d2c91f8))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([8048799](https://github.com/ibissource/frank-flow/commit/8048799e6b353bead9dfc4dc5c37d302218ff3fe))
* **deps:** bump maven-site-plugin from 3.11.0 to 3.12.0 ([9cbdf0a](https://github.com/ibissource/frank-flow/commit/9cbdf0afc4eaa50a6d4812b935850129b18a2873))
* **deps:** bump tslib from 2.3.1 to 2.4.0 in /frank-flow/src/frontend ([05b6e03](https://github.com/ibissource/frank-flow/commit/05b6e031e5866e70cfc25fb6a52646197b9b659f))


### ♻️ Chores

* create snapshot version in ci for further development ([9cb7081](https://github.com/ibissource/frank-flow/commit/9cb7081e7e7f929c1f8aae69b33bc48dc5e4f15d))
* disable double jars error ([a1d3608](https://github.com/ibissource/frank-flow/commit/a1d3608d9928c678d631cac952100310200cc9a0))
* frank runner takes to much time to start ([1105efd](https://github.com/ibissource/frank-flow/commit/1105efdde6ebd60e36cef3a281a53f42b2568f16))

## [2.19.1](https://github.com/ibissource/frank-flow/compare/v2.19.0...v2.19.1) (2022-04-21)


### 🛠 Builds

* **deps-dev:** bump karma in /frank-flow/src/frontend ([8c46c3c](https://github.com/ibissource/frank-flow/commit/8c46c3c626af6de17bda6a5060f5e5fdf086f4e3))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([c6ef86a](https://github.com/ibissource/frank-flow/commit/c6ef86a22a65c65f00fd44dece28ef98f0a5fcfa))

# [2.19.0](https://github.com/ibissource/frank-flow/compare/v2.18.0...v2.19.0) (2022-04-20)


### ✨ Features

* add function to delete flow settings ([25ff8d8](https://github.com/ibissource/frank-flow/commit/25ff8d8ab0dccd21d24d2e691f253353d528326b))
* add option to disable confirm popup ([1878307](https://github.com/ibissource/frank-flow/commit/1878307848165d76d9e9fbfdbaba60687c00f9a2))


### 🐛 Bug Fixes

* remove exits from palete and flow ([9b3f8c0](https://github.com/ibissource/frank-flow/commit/9b3f8c0262bf928dea5ecccf7a7092d71e0445d5))
* remove the add file button from header ([d15dfb9](https://github.com/ibissource/frank-flow/commit/d15dfb9bde766e61900f213bc13c2ed607af4e76))
* small refactor for clarity ([3795b9a](https://github.com/ibissource/frank-flow/commit/3795b9a1a6663c920daeb71eb620a129a7e8b657))
* some errors overlapped the header, making it impossible to switch mode ([6cf6c73](https://github.com/ibissource/frank-flow/commit/6cf6c737908b3a6ec4ba250dbaf6b7b86946fab3))


### 📦 Code Refactoring

* make the palette filter nicer in code ([bca3c3e](https://github.com/ibissource/frank-flow/commit/bca3c3e99fbe51d4ca536328ff803414696cb915))

# [2.18.0](https://github.com/ibissource/frank-flow/compare/v2.17.0...v2.18.0) (2022-04-19)


### ✨ Features

* add the right cursor type to inputs ([7384343](https://github.com/ibissource/frank-flow/commit/7384343718c1c3865a3677c8b966b0b4361b798f))
* change the styling of Settings modal ([56001d9](https://github.com/ibissource/frank-flow/commit/56001d9712d1a1f87e7ec7daa8178db65c46e693))
* make pan to node work with receivers ([ca7d236](https://github.com/ibissource/frank-flow/commit/ca7d23693288dfa37bbc0db39033c1b46f1e39b1))


### 🐛 Bug Fixes

* buttons now don't overlap the input field in add modal ([f30e653](https://github.com/ibissource/frank-flow/commit/f30e653a49d96290b98660207dd3f45a4ac784aa))
* change cursor to pointer while hovering over sidebar item ([b08b397](https://github.com/ibissource/frank-flow/commit/b08b397cdcc4c22503d9f64df53d01917623771a))
* modify modal will now cut off long file names ([45492c2](https://github.com/ibissource/frank-flow/commit/45492c2fdeecc73a95dcb55092da3bc28fe15acc))
* text in delete button now fits ([695494c](https://github.com/ibissource/frank-flow/commit/695494ca3d05c39fbec86cfaa5576fc7a76af8bb))


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([cedee81](https://github.com/ibissource/frank-flow/commit/cedee815fcccfb57b78ea1ad5a2f5de4c66eacd8))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/schematics ([bdb281d](https://github.com/ibissource/frank-flow/commit/bdb281d08d32a7e1fa15acc4111b45eb56e98056))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([7ca3210](https://github.com/ibissource/frank-flow/commit/7ca3210b6cb22d0a9a2397d20221e05411534c73))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([84de202](https://github.com/ibissource/frank-flow/commit/84de20231fd0ababaaf9a2fdcf3c7e6bb67cf11f))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([ec368eb](https://github.com/ibissource/frank-flow/commit/ec368eb8fbf5aec917155ea3a2ef7d79f0e2de2e))
* **deps:** bump ngx-toastr in /frank-flow/src/frontend ([0bc19df](https://github.com/ibissource/frank-flow/commit/0bc19dfdd00ef1558036e34f2d95493764bca831))


### 📦 Code Refactoring

* change header to be one grid and centered better ([3193d0c](https://github.com/ibissource/frank-flow/commit/3193d0c42b62a5c328f371e8898500b2173c44dd))
* move modal with sidebar styles to its own class ([1d18d25](https://github.com/ibissource/frank-flow/commit/1d18d2510539b5f44f2e9951fd4b20527fad5852))


### 📚 Documentation

* add a demo video to the readme ([44522e6](https://github.com/ibissource/frank-flow/commit/44522e6a46e589cae41ffc636385aa10fce3d2a1))


### ♻️ Chores

* update kodiak to now update dependabot, it should do a repase itself ([cd02d62](https://github.com/ibissource/frank-flow/commit/cd02d621158f95e971fd399cfbc62c1bf5f26eb1))


### 💎 Styles

* add rule to allready existing hover ([d0d1232](https://github.com/ibissource/frank-flow/commit/d0d1232854e4c37e00a75450b3788357adaf7a01))

# [2.17.0](https://github.com/ibissource/frank-flow/compare/v2.16.1...v2.17.0) (2022-04-18)


### ✨ Features

* add pan to node on nodes with no x and y in file ([d2bd287](https://github.com/ibissource/frank-flow/commit/d2bd28710f80b925368f5998a9be803fb26379bd))
* automatically convert old syntax configuration to new syntax ([05ccabe](https://github.com/ibissource/frank-flow/commit/05ccabebcd0accf195ea82cbbf58a724ce4a55ec))
* remove autoconvert and add button to where the canvas should be ([f604bc1](https://github.com/ibissource/frank-flow/commit/f604bc13d1776d9cebbcd6a6b7304a839cfddb77))


### 🐛 Bug Fixes

* change sander name in badge to sender type ([109f313](https://github.com/ibissource/frank-flow/commit/109f313f14927dcddde7200f121e1fbbe09c340a))
* user can no longer select group name ([3d68a7a](https://github.com/ibissource/frank-flow/commit/3d68a7a07d8a7963bc04d124462e48d197d622a0))


### 🛠 Builds

* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/builder ([ec8f480](https://github.com/ibissource/frank-flow/commit/ec8f4802ef64bd277debe6ad89977c5220f734af))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/eslint-plugin ([bbcf411](https://github.com/ibissource/frank-flow/commit/bbcf411a95a535a1186f459af81e46fdde27fe3a))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/eslint-plugin-template ([29af615](https://github.com/ibissource/frank-flow/commit/29af615597248d191b26222d756cfe1267c256f0))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/template-parser ([575e0de](https://github.com/ibissource/frank-flow/commit/575e0de80fdc80ca016e19d8682e22984a64a263))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([d851ec1](https://github.com/ibissource/frank-flow/commit/d851ec1da60a574ff43f5fc98e61e1ac2f19ec02))
* **deps-dev:** bump [@types](https://github.com/types)/jasmine in /frank-flow/src/frontend ([5897d62](https://github.com/ibissource/frank-flow/commit/5897d624bc02fa1cc10a488ff38564d6d95f8544))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([6c78aa2](https://github.com/ibissource/frank-flow/commit/6c78aa24d18d58143fbb625b28b35274aed0dd75))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([56fcbf2](https://github.com/ibissource/frank-flow/commit/56fcbf235238842925f1bda4b02ee6dd7a4b7b1c))
* **deps-dev:** bump karma in /frank-flow/src/frontend ([134ff8e](https://github.com/ibissource/frank-flow/commit/134ff8e9b4ae6af66a6227ba3d2b2f709212a2cc))
* **deps-dev:** bump karma-jasmine in /frank-flow/src/frontend ([e2a97c6](https://github.com/ibissource/frank-flow/commit/e2a97c6d5291037ea5be11391266a19eb5395485))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([cde6c8f](https://github.com/ibissource/frank-flow/commit/cde6c8f4a5b95217c0f0cc192b7991190273fb20))
* **deps:** bump ngx-toastr in /frank-flow/src/frontend ([6c23d1d](https://github.com/ibissource/frank-flow/commit/6c23d1d034031f9e5c9e7e0fc4e0f0248d972d0b))
* **deps:** update cxf to 3.4.7 ([417d1f1](https://github.com/ibissource/frank-flow/commit/417d1f11620775f122f53f4536c3564cb272e12b))


### 🚨 Tests

* change the debug config to be a bit more realistic ([8175cf7](https://github.com/ibissource/frank-flow/commit/8175cf7977d27f871164b7c99d55a1ac6a65f9e3))

## [2.16.1](https://github.com/ibissource/frank-flow/compare/v2.16.0...v2.16.1) (2022-04-12)


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([a2010a8](https://github.com/ibissource/frank-flow/commit/a2010a83308069fd27c9ae14d3e0787b80634703))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([7128008](https://github.com/ibissource/frank-flow/commit/7128008c24866c66001a85199f897d61ccdfcb17))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([1d97939](https://github.com/ibissource/frank-flow/commit/1d97939c460db9996fc68bf5144483f33095f06a))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([37af978](https://github.com/ibissource/frank-flow/commit/37af97808989b92211a5826579682a497ff6d8ea))
* **deps:** bump cytoscape in /frank-flow/src/frontend ([fc28e56](https://github.com/ibissource/frank-flow/commit/fc28e5683ec95d0ab65bde171b16b8959eda4f59))

# [2.16.0](https://github.com/ibissource/frank-flow/compare/v2.15.1...v2.16.0) (2022-04-06)


### ✨ Features

* add senders to the same row as the pipes in the layout ([1153019](https://github.com/ibissource/frank-flow/commit/1153019443a39c82acedc6a2b94a74b076135e19))
* keep free space when node with generated position has been moved ([2cffde0](https://github.com/ibissource/frank-flow/commit/2cffde007d4e3ee630d4e1e51c7ae72d0e9737d1))


### 🐛 Bug Fixes

* active can now be filled with a property ([69551af](https://github.com/ibissource/frank-flow/commit/69551af49641ef462cc935aa05f6cb3fe26ab631))
* implicit first pipe now works with receivers ([25076a1](https://github.com/ibissource/frank-flow/commit/25076a1dcc1139b9d2448ef420b8c0e97a35bd57))
* namespace gets added before flow attributes ([c714842](https://github.com/ibissource/frank-flow/commit/c71484291cfcd973be938e195d2fd07217888b81))
* remove errors when swithcing file ([e6c072d](https://github.com/ibissource/frank-flow/commit/e6c072dbd763ebf438ec00bf9ea75644b2ac9931))


### 🛠 Builds

* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/builder ([be28e1b](https://github.com/ibissource/frank-flow/commit/be28e1b357bc55c0a8ed68afab98e2cad45a05fe))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/eslint-plugin ([62ec9fe](https://github.com/ibissource/frank-flow/commit/62ec9fe187f1d8abf0a0932a98f43d19c272b795))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/eslint-plugin-template ([11c5ea9](https://github.com/ibissource/frank-flow/commit/11c5ea984a516faac73ecd377a2f8e9fb61fb18a))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/schematics ([836b59d](https://github.com/ibissource/frank-flow/commit/836b59d22c7a3f1131063d6ab864abb6732a8657))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/template-parser ([65a45de](https://github.com/ibissource/frank-flow/commit/65a45de37cacef7b9b27ce7b7b73a78106d725c7))
* **deps-dev:** bump [@types](https://github.com/types)/jasmine in /frank-flow/src/frontend ([80d62c1](https://github.com/ibissource/frank-flow/commit/80d62c10964b1048cf2bad9034d946f1c23f7ddb))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([f34b1fd](https://github.com/ibissource/frank-flow/commit/f34b1fd7295e871d1ea333b98f27f80e037ff083))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([6d558b5](https://github.com/ibissource/frank-flow/commit/6d558b5fc0cc96cf665bd4a41889a433eca3142f))
* **deps-dev:** bump eslint-plugin-unicorn in /frank-flow/src/frontend ([7d05303](https://github.com/ibissource/frank-flow/commit/7d053030162878fecebde9243693163fc85a6d07))
* **deps-dev:** bump prettier in /frank-flow/src/frontend ([f787e14](https://github.com/ibissource/frank-flow/commit/f787e14c492e04e6f55a1385382f655db114c085))
* **deps:** bump ngx-toastr in /frank-flow/src/frontend ([b95752d](https://github.com/ibissource/frank-flow/commit/b95752dcca1329f7d94511c5a9f9b8e38d0257f7))
* **deps:** bump tomcat.version from 9.0.60 to 9.0.62 ([2b616ee](https://github.com/ibissource/frank-flow/commit/2b616ee0f42829ea4133aa0839813c86afa83ca3))

## [2.15.1](https://github.com/ibissource/frank-flow/compare/v2.15.0...v2.15.1) (2022-04-01)


### 🐛 Bug Fixes

* error messaage about uppercase letter in type now contains type name ([67aa511](https://github.com/ibissource/frank-flow/commit/67aa5116feef797e1871e8cb70adbf3a18489fdd))

# [2.15.0](https://github.com/ibissource/frank-flow/compare/v2.14.0...v2.15.0) (2022-03-31)


### ✨ Features

* change cloud to puzzle piece in palette items ([abe521d](https://github.com/ibissource/frank-flow/commit/abe521dcacb50f319ba58a340573a9fc42c25d7a))


### 🐛 Bug Fixes

* add trash icon to (nested) node options ([d0e2c7b](https://github.com/ibissource/frank-flow/commit/d0e2c7bd4abe254c918513549a05e22e98c9b701))
* disable available attributes select if none vailable ([0b00a59](https://github.com/ibissource/frank-flow/commit/0b00a59c438db389e54a152681695e607f705d72))


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([d3e7a66](https://github.com/ibissource/frank-flow/commit/d3e7a663fbba2043460134f1969ce1a4fb91fb65))
* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([08e9f60](https://github.com/ibissource/frank-flow/commit/08e9f6028a3273da0b8cae8f780e6fed15e57fb5))
* **deps-dev:** bump [@types](https://github.com/types)/jasmine in /frank-flow/src/frontend ([8f27a46](https://github.com/ibissource/frank-flow/commit/8f27a46a6b993dff7ab09574e60b66df4ec7b48f))
* **deps-dev:** bump karma-jasmine in /frank-flow/src/frontend ([f18fc88](https://github.com/ibissource/frank-flow/commit/f18fc88891b7878c526e4f91e8adcfce93d12274))
* **deps:** bump log4j to version 2.17.2 ([3cc7939](https://github.com/ibissource/frank-flow/commit/3cc793964aef46f9f5aec876fc33dcc579cd1c49))
* **deps:** update spring to 5.3.18 and cxf to 3.4.6 ([4933267](https://github.com/ibissource/frank-flow/commit/49332676d1e411dbe5d1e27ea6257abe7f3f4fe8))


### 📦 Code Refactoring

* move observer from constructor to oninit and add unsubscribe ([b9f09bb](https://github.com/ibissource/frank-flow/commit/b9f09bbff171085d9b9723b08d189ab6da1a5024))

# [2.14.0](https://github.com/ibissource/frank-flow/compare/v2.13.0...v2.14.0) (2022-03-29)


### ✨ Features

* add elements with active attribute as a node ([64a7a42](https://github.com/ibissource/frank-flow/commit/64a7a4280f7dfd9e5bdd16e5a3682bc4240ccd30))
* add generic confirm popup ([8ca27b4](https://github.com/ibissource/frank-flow/commit/8ca27b4098e2d7584a966c23a45dbd29531136e7))
* add listener as nested element to a receiver ([1da20a3](https://github.com/ibissource/frank-flow/commit/1da20a3035e1d49a01df3416d9b00ae3d3b90a02))
* change placement algorithm to stack nodes vertically ([916e525](https://github.com/ibissource/frank-flow/commit/916e525737dbfd6e904385f7350260ae823ce753))
* make it possible to add nested elements to elements that close on the same line ([3364d82](https://github.com/ibissource/frank-flow/commit/3364d82788a7d0b57868a74c65a6c4531214c739))
* node types now have thier own column ([a39e2ed](https://github.com/ibissource/frank-flow/commit/a39e2edd6cdb66019c6776f44411c0de14d8d8a5))


### 🐛 Bug Fixes

* change text for delete confirm message ([9d2c139](https://github.com/ibissource/frank-flow/commit/9d2c13924448de4f1c8c228f3aa5b2ef09024547))
* the configurations.xml wont be renderd as flow if it contains '<!DOCTYPE Configuration' ([cb9abca](https://github.com/ibissource/frank-flow/commit/cb9abca039b7431e963eeec2c4daac9c8e7701d5))


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([bfe7a9d](https://github.com/ibissource/frank-flow/commit/bfe7a9d7f350ec24860fb2a28cf8daa122ac5eb5))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([25c1e46](https://github.com/ibissource/frank-flow/commit/25c1e463666f108d2434dc84625b32e53be9e59f))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([0086e70](https://github.com/ibissource/frank-flow/commit/0086e70026468970117fc53717b4d51eee2ab60d))

# [2.13.0](https://github.com/ibissource/frank-flow/compare/v2.12.5...v2.13.0) (2022-03-28)


### ✨ Features

* add a way to add senders wrapped in a sender pipe ([ccf5284](https://github.com/ibissource/frank-flow/commit/ccf52847d868faeb42c6df02da8cf34fa298a48e))
* add nested element component ([005aed7](https://github.com/ibissource/frank-flow/commit/005aed72b9b7ed6ca578f267cd4f1ebbb1eed7d0))
* change options modal: add available nested elements to sidebar ([336a6ca](https://github.com/ibissource/frank-flow/commit/336a6ca04ad5d440b38676a04351cafb6d979e0b))
* change styling of senders and add icon before badge ([97ace69](https://github.com/ibissource/frank-flow/commit/97ace690d8a9374f6acdab681d929e34e4aa90e3))
* change the badges of the senders so multiple senders will show a counter ([a39ab46](https://github.com/ibissource/frank-flow/commit/a39ab46b80315218b4f96904b37d0533f4a22295))
* implement add nested element button ([362aac3](https://github.com/ibissource/frank-flow/commit/362aac334ef78873359d3b6eeca3d7519a9d9f43))
* inherit the attributes of the parent element in the options window ([17aa814](https://github.com/ibissource/frank-flow/commit/17aa81405364c22b61a773ed04071f1870510441))
* make it possible to add senders to canvas ([8b09c1c](https://github.com/ibissource/frank-flow/commit/8b09c1c6590736e2d39eb9c15000cf52e7e5081e))
* make it possible to edit the nested elements ([1344de7](https://github.com/ibissource/frank-flow/commit/1344de79ece29b166c999c60a42f20a5c797b1d0))
* move sender icon within the badge ([1de7f70](https://github.com/ibissource/frank-flow/commit/1de7f7049127beeef7ca4644656c4460f981fe72))
* save attributes when adding an attribute ([7914295](https://github.com/ibissource/frank-flow/commit/791429558a3a043f2f92d8de4504f2aad41d072b))
* show all available elements when creating a new nested element ([887383d](https://github.com/ibissource/frank-flow/commit/887383d3fb3a9716ecdad1eb16fd34c974e7aaf9))


### 🐛 Bug Fixes

* add closing tag to self closing element when an nested element is added ([dadb0d4](https://github.com/ibissource/frank-flow/commit/dadb0d4c0666de67e191000aa6f5ada62185bc83))
* add timeout around add attribute ([236f8c4](https://github.com/ibissource/frank-flow/commit/236f8c4acede0d5fd6c48ecf46aa0736b0bd5d66))
* add yellow highlight to sender ([1e6b460](https://github.com/ibissource/frank-flow/commit/1e6b46074168b9212d3f0f40e7726805d6d65a53))
* adding attributes ([661d01a](https://github.com/ibissource/frank-flow/commit/661d01a171dd1667610cceeee179c464c5aa051a))
* automatically add namespace when needed ([f9eda60](https://github.com/ibissource/frank-flow/commit/f9eda601b867347405c346c2a5ae1fa63be7c942))
* beatify code for namespace service ([5bc8341](https://github.com/ibissource/frank-flow/commit/5bc8341039dc5fefbb85107aefacee9c8aaaf585))
* elements that start with a lowercase letter would couse the options to break ([2f3175a](https://github.com/ibissource/frank-flow/commit/2f3175a4c9fd81c264d7ae65c52ee30e2ab17307))
* fix adding forward on self closing tag ([47b09ab](https://github.com/ibissource/frank-flow/commit/47b09ab2c0f5be380ffb981baff6f833373e85cc))
* fix for saving name attribute on node ([325f976](https://github.com/ibissource/frank-flow/commit/325f97674201afe9e148e8c15dbdb30349736de2))
* make sure the attributes get saved ([56a9568](https://github.com/ibissource/frank-flow/commit/56a95687e3d46a4a89f6f35e2f4d6bfabcdc4bc3))
* multiple attributes from multiple nodes can now be saved at once ([31455a5](https://github.com/ibissource/frank-flow/commit/31455a5a3ca4ac05875076ad6973d02497248247))
* nested element now work with non inherited nested elements ([245e304](https://github.com/ibissource/frank-flow/commit/245e3046a2295c24205fc53c8230a772fb3c9de9))
* remove name from unclosed elements, it doesnt matter and some dont have a name ([dd27157](https://github.com/ibissource/frank-flow/commit/dd2715790b27f556423d3f027e2f603345fd3a5e))
* stop parser so it doesn't get stuck after an error ([4744424](https://github.com/ibissource/frank-flow/commit/4744424a3cb77f04daf98fddaaf27401a958db8b))
* **temp:** add a delay to adding and deleting attributes ([4633853](https://github.com/ibissource/frank-flow/commit/4633853489c0a4d4a033557eebdfa12eecbf3ffc))


### 📦 Code Refactoring

* remove unused function ([a929d8a](https://github.com/ibissource/frank-flow/commit/a929d8ab36e47fde5695925e36c87866c33a8828))
* shorten import and rename method ([3abf0b9](https://github.com/ibissource/frank-flow/commit/3abf0b9b941af234aae66f93ed330dd4dfa48274))


### 💎 Styles

* cleanup comments and add implicit perameter explicitly ([071faab](https://github.com/ibissource/frank-flow/commit/071faabda8e8365d3532f0ef61d02f6abf14af09))

## [2.12.5](https://github.com/ibissource/frank-flow/compare/v2.12.4...v2.12.5) (2022-03-25)


### 🐛 Bug Fixes

* add pointer to nodelist and make it not selectable ([6f65b85](https://github.com/ibissource/frank-flow/commit/6f65b85f3cc9da5c7875017c26191cde1ba0bb5c))


### 🛠 Builds

* **deps-dev:** bump prettier in /frank-flow/src/frontend ([63abc8b](https://github.com/ibissource/frank-flow/commit/63abc8b6e6c5b924a31c286a407b0996cfae7af4))


### ♻️ Chores

* temporary change release workflow to manual dispatch ([eff8a3a](https://github.com/ibissource/frank-flow/commit/eff8a3a81fc9a96817d4f84b86eb28d9c3868a55))

## [2.12.4](https://github.com/ibissource/frank-flow/compare/v2.12.3...v2.12.4) (2022-03-23)


### 🛠 Builds

* **deps:** bump minimist in /frank-flow/src/frontend ([c675838](https://github.com/ibissource/frank-flow/commit/c675838e79458d2bd6f5c2350142ca980dd1a372))

## [2.12.3](https://github.com/ibissource/frank-flow/compare/v2.12.2...v2.12.3) (2022-03-23)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([5db8070](https://github.com/ibissource/frank-flow/commit/5db80709e17c5687a5af6bb419f06d1e6a05f122))

## [2.12.2](https://github.com/ibissource/frank-flow/compare/v2.12.1...v2.12.2) (2022-03-22)


### 🛠 Builds

* **deps:** bump node-forge in /frank-flow/src/frontend ([ea9c24a](https://github.com/ibissource/frank-flow/commit/ea9c24a6284a71da9cec2a7104da3d4726e95c94))

## [2.12.1](https://github.com/ibissource/frank-flow/compare/v2.12.0...v2.12.1) (2022-03-22)


### 🛠 Builds

* **deps:** bump [@fortawesome](https://github.com/fortawesome)/free-regular-svg-icons ([1f2b22d](https://github.com/ibissource/frank-flow/commit/1f2b22dc2427eacbe80befb84df02b10cc900708))

# [2.12.0](https://github.com/ibissource/frank-flow/compare/v2.11.6...v2.12.0) (2022-03-21)


### ✨ Features

* add configuration settings modal ([0517adc](https://github.com/ibissource/frank-flow/commit/0517adce02433856005f6091d0aff6e63fe1f0fe))
* make highlight easier to see ([11b88e4](https://github.com/ibissource/frank-flow/commit/11b88e4be2b28226139393c03cfa220696e4f826))
* refactor flow-structure and add delete ([87f0718](https://github.com/ibissource/frank-flow/commit/87f071839a034ba465e46c4902e48a32e158fd76))


### 🐛 Bug Fixes

* add hover to link in flow settings modal ([edcc4ef](https://github.com/ibissource/frank-flow/commit/edcc4efd01a16959178c2aa9c5410ccbda4333e1))
* add yellow highlight to all nodes and fix padding ([4be4c54](https://github.com/ibissource/frank-flow/commit/4be4c540b37043cf7a155cc838cc6c07e02c8d0c))
* apply requested changes ([63ab279](https://github.com/ibissource/frank-flow/commit/63ab279f6d42c6fa5bf10900274695b99bc38749))
* flowSettings kept the settings from the previous configuration, if the current file wasn't one ([178bab4](https://github.com/ibissource/frank-flow/commit/178bab408c6f163711ad3fa9a20f0b4765d2f55f))
* remove outline on select when using Chrome-browser ([ae49f46](https://github.com/ibissource/frank-flow/commit/ae49f4601230bb4887228cb9530e4f90b17184a0))

## [2.11.6](https://github.com/ibissource/frank-flow/compare/v2.11.5...v2.11.6) (2022-03-21)


### 🐛 Bug Fixes

* add pointer cursor to buttons ([3d16beb](https://github.com/ibissource/frank-flow/commit/3d16beb906e352bbf75e6ece286fd772170f6191))


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([e8cd2da](https://github.com/ibissource/frank-flow/commit/e8cd2da699d4a62c326540b78b2371759fd3d436))

## [2.11.5](https://github.com/ibissource/frank-flow/compare/v2.11.4...v2.11.5) (2022-03-21)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([38e17b0](https://github.com/ibissource/frank-flow/commit/38e17b0645ecf0b3ff21fad47d9bf5c961f46a42))

## [2.11.4](https://github.com/ibissource/frank-flow/compare/v2.11.3...v2.11.4) (2022-03-21)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([244dd50](https://github.com/ibissource/frank-flow/commit/244dd50c3293b8fdbf18ae4db319233952527498))
* **deps:** bump [@fortawesome](https://github.com/fortawesome)/angular-fontawesome ([eb26d91](https://github.com/ibissource/frank-flow/commit/eb26d916f0eacc37ec26216d20a33c1f772a5875))

## [2.11.3](https://github.com/ibissource/frank-flow/compare/v2.11.2...v2.11.3) (2022-03-17)


### 🛠 Builds

* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([9fc5d47](https://github.com/ibissource/frank-flow/commit/9fc5d47affe276a5edf46a61a9f15b7ecd5e80c7))
* **deps-dev:** bump eslint-plugin-unicorn in /frank-flow/src/frontend ([0422fb1](https://github.com/ibissource/frank-flow/commit/0422fb1830bc62a72ecca456c05f02185314c606))

## [2.11.2](https://github.com/ibissource/frank-flow/compare/v2.11.1...v2.11.2) (2022-03-17)


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([3cd9f36](https://github.com/ibissource/frank-flow/commit/3cd9f36860bc2fa34e061e972165b4ccf0744d92))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([f48158d](https://github.com/ibissource/frank-flow/commit/f48158ddce89fed4a75ba588246b11faf0ba1333))

## [2.11.1](https://github.com/ibissource/frank-flow/compare/v2.11.0...v2.11.1) (2022-03-16)


### 🛠 Builds

* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([fd3fbe5](https://github.com/ibissource/frank-flow/commit/fd3fbe563749bc441d80783e567f67ec8bee3f6c))

# [2.11.0](https://github.com/ibissource/frank-flow/compare/v2.10.5...v2.11.0) (2022-03-16)


### ✨ Features

* add dragging hand when moving node ([8987e14](https://github.com/ibissource/frank-flow/commit/8987e14b875b4ed4cddf066a13a974ca03288cff))


### 🛠 Builds

* **deps:** bump tomcat.version from 9.0.59 to 9.0.60 ([e9bd464](https://github.com/ibissource/frank-flow/commit/e9bd46443701526a590b5f2194a576e45a5ce5cc))

## [2.10.5](https://github.com/ibissource/frank-flow/compare/v2.10.4...v2.10.5) (2022-03-16)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/jasmine in /frank-flow/src/frontend ([215789b](https://github.com/ibissource/frank-flow/commit/215789b09a0911efff64b4bff0b9075cf872c03b))

## [2.10.4](https://github.com/ibissource/frank-flow/compare/v2.10.3...v2.10.4) (2022-03-16)


### 🛠 Builds

* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/cli in /frank-flow/src/frontend ([3e82598](https://github.com/ibissource/frank-flow/commit/3e82598b542d33e2bb606140861b3eda4773355e))
* **deps-dev:** bump prettier in /frank-flow/src/frontend ([78097c7](https://github.com/ibissource/frank-flow/commit/78097c7ce995d51fb3174b731c07e80aa2de1dcd))

## [2.10.3](https://github.com/ibissource/frank-flow/compare/v2.10.2...v2.10.3) (2022-03-15)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([0fc3020](https://github.com/ibissource/frank-flow/commit/0fc302084a8cbeb024e01bdb232c5197ae858bfa))

## [2.10.2](https://github.com/ibissource/frank-flow/compare/v2.10.1...v2.10.2) (2022-03-15)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([a6bb9f0](https://github.com/ibissource/frank-flow/commit/a6bb9f0067c2edb8d682f2dec3eebc2a8c4de886))
* **deps:** bump [@fortawesome](https://github.com/fortawesome)/free-regular-svg-icons ([538c730](https://github.com/ibissource/frank-flow/commit/538c7307bca6adb1472cb5793419757851dd8b03))

## [2.10.1](https://github.com/ibissource/frank-flow/compare/v2.10.0...v2.10.1) (2022-03-14)


### 🛠 Builds

* **deps-dev:** bump eslint in /frank-flow/src/frontend ([e984d22](https://github.com/ibissource/frank-flow/commit/e984d22433374982453ed6c79aad3e23cb50614e))

# [2.10.0](https://github.com/ibissource/frank-flow/compare/v2.9.0...v2.10.0) (2022-03-14)


### ✨ Features

* change around the x and y in editor ([cdb6217](https://github.com/ibissource/frank-flow/commit/cdb6217c3444ef5722893ae4fa5697749ee2e078))

# [2.9.0](https://github.com/ibissource/frank-flow/compare/v2.8.46...v2.9.0) (2022-03-14)


### ✨ Features

* add setting for lock on node ([3d178a0](https://github.com/ibissource/frank-flow/commit/3d178a014b1ce74c60ec468c521d0f26834b883b))
* change default flow settings ([1146e68](https://github.com/ibissource/frank-flow/commit/1146e6875e33d3e654e40b2e3a0cb4fb5af9e450))
* change setting name from Panzoom to pan ([2484cbf](https://github.com/ibissource/frank-flow/commit/2484cbf6d6d5bcb130738297dba782d52c480c97))


### 🛠 Builds

* **deps:** bump maven-compiler-plugin from 3.10.0 to 3.10.1 ([7f93101](https://github.com/ibissource/frank-flow/commit/7f93101705c4e66cb74b44a4644645903652bf48))
* **deps:** bump maven-dependency-plugin from 3.2.0 to 3.3.0 ([f05dd48](https://github.com/ibissource/frank-flow/commit/f05dd48a6e2abc03aed56bce560a093d7753ecc5))

## [2.8.46](https://github.com/ibissource/frank-flow/compare/v2.8.45...v2.8.46) (2022-03-11)


### 🛠 Builds

* **deps:** bump monaco-editor in /frank-flow/src/frontend ([420bb04](https://github.com/ibissource/frank-flow/commit/420bb04a2d3b5cafcc357fc0f7ba02d7abe3c3ee))

## [2.8.45](https://github.com/ibissource/frank-flow/compare/v2.8.44...v2.8.45) (2022-03-10)


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([d407cf8](https://github.com/ibissource/frank-flow/commit/d407cf899654e4bf149e958088976b1839cdec41))
* **deps-dev:** bump karma-chrome-launcher in /frank-flow/src/frontend ([70c54d8](https://github.com/ibissource/frank-flow/commit/70c54d8e3401797093a0f9654ef7110b0bdf02d6))

## [2.8.44](https://github.com/ibissource/frank-flow/compare/v2.8.43...v2.8.44) (2022-03-10)


### 🛠 Builds

* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([d294064](https://github.com/ibissource/frank-flow/commit/d2940644f35a0e979bd557348bba486265f14306))

## [2.8.43](https://github.com/ibissource/frank-flow/compare/v2.8.42...v2.8.43) (2022-03-08)


### 🛠 Builds

* **deps:** bump rxjs from 7.5.4 to 7.5.5 in /frank-flow/src/frontend ([4a9b557](https://github.com/ibissource/frank-flow/commit/4a9b557d309c6b17d904785167847b1f75c0dde5))

## [2.8.42](https://github.com/ibissource/frank-flow/compare/v2.8.41...v2.8.42) (2022-03-08)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([119dd51](https://github.com/ibissource/frank-flow/commit/119dd5197f6afc74378508930c38d472a6fec46f))

## [2.8.41](https://github.com/ibissource/frank-flow/compare/v2.8.40...v2.8.41) (2022-03-07)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([33fde8a](https://github.com/ibissource/frank-flow/commit/33fde8af0708c1ebd70c6ad99e96e83ce093cf8f))

## [2.8.40](https://github.com/ibissource/frank-flow/compare/v2.8.39...v2.8.40) (2022-03-07)


### 🛠 Builds

* **deps:** bump ngx-toastr in /frank-flow/src/frontend ([64230e9](https://github.com/ibissource/frank-flow/commit/64230e9fcd13e69ebc6acd2c35baa6759915d2e2))

## [2.8.39](https://github.com/ibissource/frank-flow/compare/v2.8.38...v2.8.39) (2022-03-07)


### 🛠 Builds

* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([a4e3fb6](https://github.com/ibissource/frank-flow/commit/a4e3fb677425c7aa0103a963aef6a92c491b8a92))
* **deps-dev:** bump ts-node in /frank-flow/src/frontend ([c17c0b4](https://github.com/ibissource/frank-flow/commit/c17c0b40844510b5ba2d0175aeddbdea4bb9c28d))

## [2.8.38](https://github.com/ibissource/frank-flow/compare/v2.8.37...v2.8.38) (2022-03-04)


### 🛠 Builds

* **deps:** bump zone.js in /frank-flow/src/frontend ([77b21ca](https://github.com/ibissource/frank-flow/commit/77b21cadea079511cd8208a9432674595f0da4e0))

## [2.8.37](https://github.com/ibissource/frank-flow/compare/v2.8.36...v2.8.37) (2022-03-03)


### 🛠 Builds

* **deps-dev:** bump eslint-config-prettier in /frank-flow/src/frontend ([544c2c0](https://github.com/ibissource/frank-flow/commit/544c2c07e67e6d9a7f3ea2ebd4d54d3a393ba41f))

## [2.8.36](https://github.com/ibissource/frank-flow/compare/v2.8.35...v2.8.36) (2022-03-02)


### 🛠 Builds

* **deps-dev:** bump ts-node in /frank-flow/src/frontend ([2cccd7c](https://github.com/ibissource/frank-flow/commit/2cccd7ccdf884bf5102cdb42d97cacb3cc80f9dc))
* **deps:** bump tomcat.version from 9.0.58 to 9.0.59 ([83033c8](https://github.com/ibissource/frank-flow/commit/83033c8731715b322c768325733e2fc1f71ce263))

## [2.8.35](https://github.com/ibissource/frank-flow/compare/v2.8.34...v2.8.35) (2022-03-02)


### 🛠 Builds

* **deps-dev:** bump karma in /frank-flow/src/frontend ([c2aaba8](https://github.com/ibissource/frank-flow/commit/c2aaba8366920422634575d2c6247e9c3607028f))

## [2.8.34](https://github.com/ibissource/frank-flow/compare/v2.8.33...v2.8.34) (2022-03-02)

## [2.8.33](https://github.com/ibissource/frank-flow/compare/v2.8.32...v2.8.33) (2022-02-28)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([4f63ad8](https://github.com/ibissource/frank-flow/commit/4f63ad8afe8f75245a48fbf1702e9590265c9c7b))
* **deps:** bump log4j2.version from 2.17.1 to 2.17.2 ([0a39733](https://github.com/ibissource/frank-flow/commit/0a397334da7f95c54c06b4e87cfb9cb8ea16cf44))

## [2.8.32](https://github.com/ibissource/frank-flow/compare/v2.8.31...v2.8.32) (2022-02-28)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([9daf603](https://github.com/ibissource/frank-flow/commit/9daf603741d75808f649b1c58e3cea89d1848664))

## [2.8.31](https://github.com/ibissource/frank-flow/compare/v2.8.30...v2.8.31) (2022-02-28)


### 🛠 Builds

* **deps-dev:** bump eslint in /frank-flow/src/frontend ([910557f](https://github.com/ibissource/frank-flow/commit/910557f448bb371a60e867f92f6d62db15cfdce1))

## [2.8.30](https://github.com/ibissource/frank-flow/compare/v2.8.29...v2.8.30) (2022-02-24)


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([223fb90](https://github.com/ibissource/frank-flow/commit/223fb909b8205592e13e544b7bf7ff69027c7aed))

## [2.8.29](https://github.com/ibissource/frank-flow/compare/v2.8.28...v2.8.29) (2022-02-24)


### 🛠 Builds

* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([7e1d862](https://github.com/ibissource/frank-flow/commit/7e1d8623b4ebadd735eece587b5f45452738eec4))

## [2.8.28](https://github.com/ibissource/frank-flow/compare/v2.8.27...v2.8.28) (2022-02-23)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([951fc67](https://github.com/ibissource/frank-flow/commit/951fc67a0ec52b0f2fdb7ba1f3584a65c4a76dcf))

## [2.8.27](https://github.com/ibissource/frank-flow/compare/v2.8.26...v2.8.27) (2022-02-22)


### 🛠 Builds

* **deps-dev:** bump jasmine-core in /frank-flow/src/frontend ([388a321](https://github.com/ibissource/frank-flow/commit/388a321e6cb84099d7e79397ea84ce11c38a0779))

## [2.8.26](https://github.com/ibissource/frank-flow/compare/v2.8.25...v2.8.26) (2022-02-21)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([dd15ad5](https://github.com/ibissource/frank-flow/commit/dd15ad5a0636f8269b6aeb8856195fea5a87f467))

## [2.8.25](https://github.com/ibissource/frank-flow/compare/v2.8.24...v2.8.25) (2022-02-21)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([8ec0176](https://github.com/ibissource/frank-flow/commit/8ec0176756f31ba9c3caeb948f445d660160807f))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([a77e5ad](https://github.com/ibissource/frank-flow/commit/a77e5ad35245b8c4243275c6d6105b274467ab6c))
* **deps-dev:** bump eslint-config-prettier in /frank-flow/src/frontend ([f3f10ef](https://github.com/ibissource/frank-flow/commit/f3f10ef78460b565e9461cba8ffd5511e4bf0455))

## [2.8.24](https://github.com/ibissource/frank-flow/compare/v2.8.23...v2.8.24) (2022-02-19)


### 🛠 Builds

* **deps:** bump maven-site-plugin from 3.10.0 to 3.11.0 ([799c290](https://github.com/ibissource/frank-flow/commit/799c290fd837ad7ed2f395102f0261c28d7f3898))

## [2.8.23](https://github.com/ibissource/frank-flow/compare/v2.8.22...v2.8.23) (2022-02-18)


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([6f5ed19](https://github.com/ibissource/frank-flow/commit/6f5ed192002683b961ac8d56fe7198bc1c3b2042))

## [2.8.22](https://github.com/ibissource/frank-flow/compare/v2.8.21...v2.8.22) (2022-02-18)


### 🛠 Builds

* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([e70fb47](https://github.com/ibissource/frank-flow/commit/e70fb47d3696126eaa231aba8831f5c9a127d51e))

## [2.8.21](https://github.com/ibissource/frank-flow/compare/v2.8.20...v2.8.21) (2022-02-18)


### 🛠 Builds

* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/schematics ([8943385](https://github.com/ibissource/frank-flow/commit/8943385f32927e98f7b4612ac7d0344f22d70eb1))

## [2.8.20](https://github.com/ibissource/frank-flow/compare/v2.8.19...v2.8.20) (2022-02-16)


### 🛠 Builds

* **deps-dev:** bump eslint-plugin-unicorn in /frank-flow/src/frontend ([45e1b7e](https://github.com/ibissource/frank-flow/commit/45e1b7eb68ab24001dae482c144a018dc4215bcd))

## [2.8.19](https://github.com/ibissource/frank-flow/compare/v2.8.18...v2.8.19) (2022-02-16)


### 🛠 Builds

* **deps:** bump maven-compiler-plugin from 3.9.0 to 3.10.0 ([ffab7ab](https://github.com/ibissource/frank-flow/commit/ffab7ab3923dd111ed3328d275b7381181e73cd6))

## [2.8.18](https://github.com/ibissource/frank-flow/compare/v2.8.17...v2.8.18) (2022-02-15)


### 🛠 Builds

* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/builder ([bc26e82](https://github.com/ibissource/frank-flow/commit/bc26e82a6666f2e9cfd8cb09bf78e2df2e7f8320))

## [2.8.17](https://github.com/ibissource/frank-flow/compare/v2.8.16...v2.8.17) (2022-02-15)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([d851864](https://github.com/ibissource/frank-flow/commit/d85186444e5b6396cb83559b86f13db18ecac0e1))

## [2.8.16](https://github.com/ibissource/frank-flow/compare/v2.8.15...v2.8.16) (2022-02-15)


### 🛠 Builds

* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/config-conventional ([63282bc](https://github.com/ibissource/frank-flow/commit/63282bc43092fd82de413bbfc09c2ac2bea01934))

## [2.8.15](https://github.com/ibissource/frank-flow/compare/v2.8.14...v2.8.15) (2022-02-15)


### 🛠 Builds

* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/eslint-plugin ([2bff470](https://github.com/ibissource/frank-flow/commit/2bff4701e2c24207270b6a01291f466de7290061))
* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/template-parser ([dd08502](https://github.com/ibissource/frank-flow/commit/dd08502d1cf83d272578962df042a04921c105aa))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([86281db](https://github.com/ibissource/frank-flow/commit/86281dbdb5c0449141d8070361eb6a7e0846f531))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([cda7413](https://github.com/ibissource/frank-flow/commit/cda7413567f80602d277acdcf2741745b6f8a188))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([088fe27](https://github.com/ibissource/frank-flow/commit/088fe27c82146ea0a0070770566b23a15f4b57c2))

## [2.8.14](https://github.com/ibissource/frank-flow/compare/v2.8.13...v2.8.14) (2022-02-14)


### 🛠 Builds

* **deps-dev:** bump [@angular-eslint](https://github.com/angular-eslint)/eslint-plugin-template ([ef0de1d](https://github.com/ibissource/frank-flow/commit/ef0de1d055997158bb5602650fcb441e9d33c563))
* **deps:** bump follow-redirects in /frank-flow/src/frontend ([3736bd9](https://github.com/ibissource/frank-flow/commit/3736bd94864f584712b0cb0a12b04aaf7c0a8295))

## [2.8.13](https://github.com/ibissource/frank-flow/compare/v2.8.12...v2.8.13) (2022-02-14)


### 🛠 Builds

* **deps-dev:** bump [@commitlint](https://github.com/commitlint)/cli in /frank-flow/src/frontend ([688cc40](https://github.com/ibissource/frank-flow/commit/688cc4018d334e1fa575d13dfeae714d9b056e76))
* **deps-dev:** bump eslint in /frank-flow/src/frontend ([77fe531](https://github.com/ibissource/frank-flow/commit/77fe53102933014a6eb913cbe0f5c7c189a31ee8))

## [2.8.12](https://github.com/ibissource/frank-flow/compare/v2.8.11...v2.8.12) (2022-02-10)


### 🛠 Builds

* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([f2cf4e2](https://github.com/ibissource/frank-flow/commit/f2cf4e2cbe05a3a8c461fdef35c46b3e528423f1))
* **deps-dev:** bump karma-coverage in /frank-flow/src/frontend ([2e3d674](https://github.com/ibissource/frank-flow/commit/2e3d674a8ddcd1563d17fa4525842e6cb943cf42))

## [2.8.11](https://github.com/ibissource/frank-flow/compare/v2.8.10...v2.8.11) (2022-02-10)


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([f68f69d](https://github.com/ibissource/frank-flow/commit/f68f69d37acb8519ccef2b756857c8a2f41845ae))
* **deps-dev:** bump karma in /frank-flow/src/frontend ([ffa77cc](https://github.com/ibissource/frank-flow/commit/ffa77ccd908e0fd3175a3e590d5757582e6061e0))

## [2.8.10](https://github.com/ibissource/frank-flow/compare/v2.8.9...v2.8.10) (2022-02-10)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([5e68fbd](https://github.com/ibissource/frank-flow/commit/5e68fbd5d79035cc395f780590980fcc1ddc09cd))

## [2.8.9](https://github.com/ibissource/frank-flow/compare/v2.8.8...v2.8.9) (2022-02-09)


### 🛠 Builds

* **deps:** bump rxjs from 7.5.3 to 7.5.4 in /frank-flow/src/frontend ([24959da](https://github.com/ibissource/frank-flow/commit/24959dacc9b4bc5486ed1e688b86599a676b0707))

## [2.8.8](https://github.com/ibissource/frank-flow/compare/v2.8.7...v2.8.8) (2022-02-09)


### 🛠 Builds

* **deps-dev:** bump karma in /frank-flow/src/frontend ([e025f28](https://github.com/ibissource/frank-flow/commit/e025f28fa4ac9d10b29f2f0d417ff2380acea9ab))

## [2.8.7](https://github.com/ibissource/frank-flow/compare/v2.8.6...v2.8.7) (2022-02-08)


### 🛠 Builds

* **deps:** bump [@fortawesome](https://github.com/fortawesome)/free-regular-svg-icons ([6bb8088](https://github.com/ibissource/frank-flow/commit/6bb808898cb95116d5116ba11c794bb5cf7d7ff9))
* **deps:** bump rxjs from 7.5.2 to 7.5.3 in /frank-flow/src/frontend ([02d3786](https://github.com/ibissource/frank-flow/commit/02d37867645a1b7819667c286e916d251d3410ca))

## [2.8.6](https://github.com/ibissource/frank-flow/compare/v2.8.5...v2.8.6) (2022-02-08)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([6ac4d24](https://github.com/ibissource/frank-flow/commit/6ac4d245c991ebcbf2a090a635c96728a850c42c))
* **deps:** bump cytoscape in /frank-flow/src/frontend ([54f0922](https://github.com/ibissource/frank-flow/commit/54f092203e7011246e473815fe3ab1c7958c72b9))

## [2.8.5](https://github.com/ibissource/frank-flow/compare/v2.8.4...v2.8.5) (2022-02-07)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([2b978f8](https://github.com/ibissource/frank-flow/commit/2b978f80fb596cf6a4b45c143d61c256266c7a45))
* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([4ce2441](https://github.com/ibissource/frank-flow/commit/4ce2441a74773b4088c23a33bb290af50e700dbf))

## [2.8.4](https://github.com/ibissource/frank-flow/compare/v2.8.3...v2.8.4) (2022-02-07)


### 🛠 Builds

* **deps-dev:** bump ts-node in /frank-flow/src/frontend ([a79b1c3](https://github.com/ibissource/frank-flow/commit/a79b1c3c27c54485e2b228e93b0c876ec0c96083))
* **deps:** bump monaco-editor in /frank-flow/src/frontend ([4796162](https://github.com/ibissource/frank-flow/commit/47961628f5de0b7f435f41e93d12e65a4463609c))

## [2.8.3](https://github.com/ibissource/frank-flow/compare/v2.8.2...v2.8.3) (2022-02-07)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([318a9fa](https://github.com/ibissource/frank-flow/commit/318a9fa8ab36f11788e13baacf2f82ee27dd0ed5))
* **deps-dev:** bump karma-coverage in /frank-flow/src/frontend ([921001f](https://github.com/ibissource/frank-flow/commit/921001f779ec36f6def8adbf83fb6f64592f1627))

## [2.8.2](https://github.com/ibissource/frank-flow/compare/v2.8.1...v2.8.2) (2022-02-03)


### 🛠 Builds

* **deps-dev:** bump karma in /frank-flow/src/frontend ([3e24ce7](https://github.com/ibissource/frank-flow/commit/3e24ce715c7205bdd6e5f6bb4c68593697abce58))
* **deps:** bump monaco-editor in /frank-flow/src/frontend ([f49fd5d](https://github.com/ibissource/frank-flow/commit/f49fd5d10170993460323bcc4ed286ac839a5fca))

## [2.8.1](https://github.com/ibissource/frank-flow/compare/v2.8.0...v2.8.1) (2022-02-03)


### 🛠 Builds

* **deps-dev:** bump [@angular-devkit](https://github.com/angular-devkit)/build-angular ([18925e7](https://github.com/ibissource/frank-flow/commit/18925e7fd61770b762007b59729deb3e2b4a204d))
* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([cd772a7](https://github.com/ibissource/frank-flow/commit/cd772a7b7107bcb0ba0846faacaa0f4fe8107d4c))
* **deps-dev:** bump lint-staged in /frank-flow/src/frontend ([e34e5cf](https://github.com/ibissource/frank-flow/commit/e34e5cf41a28e58ab94b7ad5ad8663b2b54c3db5))

# [2.8.0](https://github.com/ibissource/frank-flow/compare/v2.7.5...v2.8.0) (2022-02-03)


### ✨ Features

* add background blur to transparent elements ([eafe2b9](https://github.com/ibissource/frank-flow/commit/eafe2b90086a1412701c5578bebe252bd143a5c9))
* add shadow to connections, fix hr in modal and style toastr ([152e2f9](https://github.com/ibissource/frank-flow/commit/152e2f9898d036cc4e0f83214c044e734c3c64ae))
* add shadows to header and sidebars and change file-tree ([561cc1c](https://github.com/ibissource/frank-flow/commit/561cc1caba47ab66203d5dbf69b892224efb77cf))
* change scss variables and implement shadows and buttons differently ([f825e80](https://github.com/ibissource/frank-flow/commit/f825e80939aea14bf6321acbe17c452693e83cc9))
* change some font and border sizes and aligning ([7ef1a12](https://github.com/ibissource/frank-flow/commit/7ef1a12572a2958f38eff26d0b84a1c290c88cfb))
* change some font and border sizes and aligning ([c12ce11](https://github.com/ibissource/frank-flow/commit/c12ce117d29c5035c9b521b57c5ac16e2d2dc301))
* change the styling to a more modern look ([e66a53f](https://github.com/ibissource/frank-flow/commit/e66a53f02f6ed6233c97c5932f7908ffbf1f6f17))
* make the no convas message as big as the actions (with lager buttons) ([364cbc0](https://github.com/ibissource/frank-flow/commit/364cbc0aac6cdc2150be0f20327680c6e1f510b6))
* remove padding when node is active so content doesn't move ([65a5390](https://github.com/ibissource/frank-flow/commit/65a5390abf53924cebe7a3e77f6c3d258d204e07))


### 🛠 Builds

* **deps-dev:** bump [@angular](https://github.com/angular)/cli in /frank-flow/src/frontend ([cc779ea](https://github.com/ibissource/frank-flow/commit/cc779ea33b4850fc4ecbdafe7c1862f93fdc3892))


### 🗑 Reverts

* change frank-runner.properties back ([0706ee7](https://github.com/ibissource/frank-flow/commit/0706ee713091b917e898592e2c41cf8bddf643c9))

## [2.7.5](https://github.com/ibissource/frank-flow/compare/v2.7.4...v2.7.5) (2022-01-31)


### 🛠 Builds

* **deps-dev:** bump eslint in /frank-flow/src/frontend ([8e13599](https://github.com/ibissource/frank-flow/commit/8e1359939a69d6b4859b3a3050d47fdb8be433c7))

## [2.7.4](https://github.com/ibissource/frank-flow/compare/v2.7.3...v2.7.4) (2022-01-31)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/eslint-plugin ([9444aaa](https://github.com/ibissource/frank-flow/commit/9444aaa174b03719947d05bda0f584447a5ca35e))

## [2.7.3](https://github.com/ibissource/frank-flow/compare/v2.7.2...v2.7.3) (2022-01-31)


### 🛠 Builds

* **deps-dev:** bump [@typescript-eslint](https://github.com/typescript-eslint)/parser ([758d84c](https://github.com/ibissource/frank-flow/commit/758d84c6f79be1914a01f2fb7d7446ddece46550))

## [2.7.2](https://github.com/ibissource/frank-flow/compare/v2.7.1...v2.7.2) (2022-01-28)


### 🛠 Builds

* **deps-dev:** bump [@types](https://github.com/types)/node in /frank-flow/src/frontend ([3be3425](https://github.com/ibissource/frank-flow/commit/3be3425459ad3e7ed554cfb7eb026323702e5776))

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
