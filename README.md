# Frank!Flow

_Graphical flow editor for Frank configurations._

This project will help you visualize and edit your adapters in a flow format. The configurations should be in the “beautiful” syntax.

The project has been tested in Mozilla Firefox and Google Chrome, other browsers will possibly give an inaccurate representation of the editor. If you'd like to report a bug, you can do so [here](https://github.com/ibissource/frank-flow/issues/new?assignees=&labels=bug&template=bug_report.md).

## Demo's

### 📺 Frank!Flow workflow demonstration video

[![image](https://user-images.githubusercontent.com/12416423/163985224-0acb276c-bd0c-4c86-bc8c-14dbf22d1bdc.png)](https://wearefrank.tv/watch/151)
Watch [this video on WeAreFrank! TV](https://wearefrank.tv/watch/151) for a demonstration on how to create a configuration with the Frank!Flow.

### 🕹️ Hands-on online demo

A demo of the Frank!Flow is made general available and can be visited at [flow.frankframework.org](https://flow.frankframework.org). This demo makes use of a read-only file-system, so it won't be possible to save files or to perform other actions on the file-system.

## Features of the Frank!Flow

First of all, the Frank!Flow consists of three 'modes' or 'views'. These are: Flow, Hybrid and Editor. Each of the modes focus on a specific use case, like editing visually or programatically. The modes are made with usability in mind, which means that the Flow is the most simple and the Editor is the most advanced.

### 📁 Explorer

The Explorer is presented on the left side of the application and can be shown or hidden with a toggle. The explorer will help you to browse configurations, add, rename and delete them. The Explorer is a representation of the file-system where your configurations are located.

There are some buttons associated with the Explorer that will perform actions on the file-system. Three buttons are located on the header and are used for adding, saving and modifying the current file (respectively). The modify button will open a modal in which the file can be renamed or deleted. The four buttons above the Explorer in Editor mode are used for adding, deleting and modifying a file as well as refreshing the Explorer (handy when files have changed on the file-system). A file or folder can be added to  by selecting the folder first then pressing the add button.

You can select a configuration by clicking on it. The Flow will be loaded on the Canvas.

### 🎨 Palette

The palette contains all the usable listeners, pipes and an exit out of which the adapters are built. These elements are categorized by type and are searchable with the search bar above.

The element will be added to the canvas by clicking on it.

### 🏗️Flow

The Flow is the main attraction of the application and has a lot of hidden features. There are a number of ways to manipulate the Flow:

- You can move the elements by dragging them around.
- A forward can be created by dragging from the green circle of the first element, to the yellow circle of the second element. While dragging you can see an arrow, pointing in the direction of the forward.
- A forward can be removed by double clicking it or by disconnecting it from the circle. The latter can be tricky if there are a lot of forwards connected to an element.

The Flow shows the connection from a listener to a pipe in blue because it isn't a forward. In the XML it is defined as `firstPipe` on the `pipeline`. When no first pipe has been assigned, the Flow will show a dashed line to show the implicitly selected first pipe. The user can manipulate the first pipe by dragging a connection as if it was a forward.

### 🎛 Pipe options

You can select an element by double clicking it on the canvas. The options of the pipe will be opened in a modal in the middle of the screen. Information about the element is given at the top of the modal and it also has a button that will take you to the Frank!Doc of the element. In the middle section it is possible to add, edit and delete attributes on the element.  Finally there is a delete button at the bottom, which will remove the element all together.

### ⌨ Editor

While the Flow can help you manipulate your adapter, there are still some people that want some more control or are used to editing the adapter in XML-code. The Editor has a lot of features similar to Visual Studio Code because it is based on the [Monaco Editor](https://microsoft.github.io/monaco-editor/)

### 🔁 Hybrid

The Hybrid mode is a combination of the Editor and the Flow modes. It will show you every modification you make in real-time. For example, if you add an element to the Flow, it will automatically get inserted into the XML and the other way around. This mode is a great way to learn XML or to get an overview of an already existing configuration. 

### ⚙️ Configuration Flow Settings

One of the important things that may get overlooked, is the shareability of the configurations. After creating a configuration in the Flow, it will have a specific layout that would (hopefully) look pleasing. To ensure that others see the Flow the same way as you do, it could be useful to add your Flow settings to the configuration. This can be done by placing them as attributes in the `<Configuration>` tag of your configuration. Momentarily, this can only be done via the Editor.

The available settings are:

| Attribute           | Available values                  |
| ------------------- | --------------------------------- |
| `flow:direction`    | `bezier`, `flowchart`, `straight` |
| `flow:forwardStyle` | `horizontal`, `vertical`          |
| `flow:gridSize`     | `0`, `10`, `25`, `50`, `100`      |

## How to use the Frank!Flow

### Frank!Runner

The easiest way to get started with the Frank!Flow is with help of the [Frank!Runner](https://github.com/ibissource/frank-runner). Start a Frank and navigate to http://localhost/frank-flow.

### Without the Frank!Runner

It is recommended to use the Frank!Runner, because it will ensure that the Frank!Flow can be used while configuring a Frank! without it getting in production. If you want to include the Frank!Flow manually, follow the [instructions for developers](#add-the-frankflow-to-a-frank).

## Developing the Frank!Flow

If you’d like to develop the Frank!Flow it would be handy to store the Frank!Flow project in a folder next to the Frank!Runner. This is recommended because there is a pre-made Frank and `build.xml` to test with.

This project consists of two main parts: The Angular (TypeScript) frontend and the Java backend.

### Preparations

#### Requirements

There are some basic requirements that are needed to test or develop the Frank!Flow application. These requirements are:

##### Backend

- [Java](https://www.java.com/nl/download/)
- [Maven](http://maven.apache.org/)

##### Frontend

- [Node.js](https://nodejs.org/en/)
- [Yarn](https://yarnpkg.com/getting-started/install)

##### Add the Frank!Flow to a Frank!

The Frank!Flow should run as part of the Frank!Framework so it has access to the Frank!Doc and configuration files.

###### Maven

To include the Frank!Flow in a Frank! it's easiest to do this automatically with maven. Otherwise, you'll have to copy the build artifact to the [webapp folder](#manually-add-the-frankflow) manually.

The POM will tell Maven which extra dependencies you want to download. In this case we want the artifact “frank-flow”. Add the following dependencies and repository to the `pom.xml`:

```XML
<dependencies>
    <dependency>
        <groupId>org.ibissource</groupId>
        <artifactId>ibis-adapterframework-webapp</artifactId>
        <version>[7.7,)</version>
        <type>war</type>
    </dependency>
    <dependency>
        <groupId>org.ibissource</groupId>
        <artifactId>frank-flow</artifactId>
        <version>[2.2,)</version>
    </dependency>
</dependencies>

<repositories>
    <repository>
        <id>ibissource</id>
        <name>Ibissource</name>
        <url>https://nexus.ibissource.org/content/repositories/public</url>
    </repository>
</repositories>
```

Notice the added repository, this is needed because the Frank!Flow is hosted on the [Frank!Framework Maven Repository](https://nexus.frankframework.org).

###### Manually add the Frank!Flow

The Frank!Flow will be build as a `.jar` file. This file  includes everything for the Frank!Flow to work in a Tomcat webapp. To  get the Frank!Flow to work in an existing Frank! place the [Frank!Flow Artifact](https://nexus.frankframework.org/service/rest/repository/browse/releases/org/ibissource/frank-flow/) in the `WEB-INF/lib` folder of the Tomcat webapp.

#### DevTools

There are some tools that have to be used during development. These tools are needed for linters that keep the code clean and formatted the same way. The tools get run automatically by a Git hook.

To install the tools go to the folder `frank-flow/src/frontend`. Run `yarn` in this folder and everything should be good to go. This is needed because of the way this mono repo has been structured. This structure might change in the feature.

### Frontend

The code for the frontend is located at `frank-flow/src/frontend`. This folder contains the cypress integration tests, the source files for the application and configurations. 

#### Building the frontend

There are two ways to build the application, for development and for production. The difference lays in the way the code gets optimized.

##### Development

The dist folder is located at  `frank-flow/target/frontend`. Set the absolute path of this folder as [frontend path in the properties file](#configuration) so the Frank!Runner knows which files to serve. To build a development version you can run `yarn build:dev` or `yarn watch` if you want to build continually. The code won’t be minified which will make it easier to debug.

##### Production

You can make a production build by running the command `yarn build:prod` or by [building the whole application](#building-the-whole-application).

##### Analyze build

To analyze the size of the build and which files are making it so big, run `yarn build:analyze`.

### Backend

The backend is used to serve the frontend and as an API for getting files from the file-system. The code is located at `frank-flow/src/main/java`.

#### Building the backend

There are two simple ways to build the backend, for development and production use.

##### Building just the backend

The easiest option while developing is to just run `mvn install`. This will only build the backend. This could be usefull if you're just developing the API or if the frontend is being served by the Frank!Runner.

##### Building the whole application

The other option to run `mvn install -P frontend`. This command builds both the backend and the frontend. It is meant for production, because this command will also install Node.js and NPM to build the production frontend in a CI environment.

### Configuration

The Frank!Flow has some configuration options which are mainly used for the backend. The configuration options can be set by placing them in a `frank-flow.properties` file. Every property should be on it's own line and be followed by an equals sign (`=`) and a value. The properties file should be placed in the location from where the Frank!Flow gets start. While developing with the Frank!Runner this would be in the root of the folder `frank-runner`.

| Property                   | Description                                      | Default value                        |
| -------------------------- | ------------------------------------------------ | ------------------------------------ |
| `frank-flow.frontend-path` | The location of the dist folder for the frontend | The frontend in the JAR will be used |
| `frank-flow.context-path`  | The URL at which the Frank!Flow will be served   | `/frank-flow/`                       |
| `frank-flow.port`          | The port which the build-in Tomcat should use    | `8080`                               |
| `frank-flow.war`           | The webapp war                                   | `/frank-flow-webapp.war`             |
