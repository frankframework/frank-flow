# Frank!Flow<sup>beta</sub>

_Graphical flow editor for Frank!Configs._

This project will help you visualize and edit your adapters in a flow format. 
The configurations should be in the “beautiful” syntax.

If you notice and problems or bugs, please [open an issue](https://github.com/ibissource/frank-flow/issues/new?assignees=&labels=bug&template=bug_report.md).

## Like to see the Frank!Flow in action?

### 🕹️ Hands-on demo

Try it out in a hands-on demo at [flow.frankframework.org](https://flow.frankframework.org). 
This demo makes use of a read-only file-system, so it won't be possible to save files or to perform other actions on the file-system.

### 📺 Frank!Flow workflow demonstration video

Watch [this video on WeAreFrank! TV](https://wearefrank.tv/watch/151) for a demonstration on how to create a configuration with the Frank!Flow.
[![image](https://user-images.githubusercontent.com/12416423/163985224-0acb276c-bd0c-4c86-bc8c-14dbf22d1bdc.png)](https://wearefrank.tv/watch/151)

## ✨ Features of the Frank!Flow

First of all, the Frank!Flow can be used in three ways. 
Visually with the node editor, programmatically with the code editor or the two combined in hybrid mode.

The node editor is simple to use and can assist you in creating a configuration. 
The code editor is more powerful and can be used to edit the configuration in XML-code. 
The hybrid mode is a combination of the two and will show you every modification you make in real-time. 
For example, if you add an element to the Flow, it will automatically get inserted into the XML and the other way around. 
This mode is a great way to learn XML or to get an overview of an already existing configuration.

### 📁 Explorer

The Explorer is presented on the left side of the application and can be shown or hidden with a toggle. 
The explorer will help you to browse configurations, add, rename and delete them. 
The Explorer is a representation of the file-system where your configurations are located.

There are some buttons associated with the Explorer that will perform actions on the file-system. 
Three buttons are located on the header and are used for adding, saving and modifying the current file (respectively). 
The modify button will open a modal in which the file can be renamed or deleted. 
The four buttons above the Explorer in Editor mode are used for adding, deleting and modifying a file as well as refreshing the Explorer (handy when files have changed on the file-system). 
A file or folder can be added to  by selecting the folder first then pressing the add button.

You can select a configuration by clicking on it. The Flow will be loaded on the Canvas.

### 🎨 Palette

The palette contains all the usable listeners, pipes and an exit out of which the adapters are built. 
These elements are categorized by type and are searchable with the search bar above.

The element will be added to the canvas by clicking on it.

### 🏗️Flow

The Flow is the main attraction of the application and has a lot of hidden features. There are a number of ways to manipulate the Flow:

- You can move the elements by dragging them around.
- A forward can be created by dragging from the green circle of the first element, to the yellow circle of the second element. While dragging you can see an arrow, pointing in the direction of the forward.
- A forward can be removed by double-clicking it or by disconnecting it from the circle. The latter can be tricky if there are a lot of forwards connected to an element.

The Flow shows the connection from a listener to a pipe in blue because it isn't a forward. In the XML it is defined as `firstPipe` on the `pipeline`. When no first pipe has been assigned, the Flow will show a dashed line to show the implicitly selected first pipe. The user can manipulate the first pipe by dragging a connection as if it was a forward.

### 🎛 Pipe options

You can select an element by double-clicking it on the canvas. The options of the pipe will be opened in a modal in the middle of the screen. Information about the element is given at the top of the modal and it also has a button that will take you to the Frank!Doc of the element. In the middle section it is possible to add, edit and delete attributes on the element.  Finally there is a delete button at the bottom, which will remove the element all together.

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

## Get up and running with the Frank!Flow

### 🏃 Frank!Runner

The easiest way to get started with the Frank!Flow is with help of the [Frank!Runner](https://github.com/ibissource/frank-runner).
Start a Frank and navigate to http://localhost/frank-flow.

### Without the Frank!Runner

The Frank!Flow can be run without the Frank!Runner. There is however some extra configuration needed.

If the Frank!Flow is running on the same host as the Frank!Framework, it might be able to figure out the location of the <!-- TODO: Frank!Doc and --> configuration files.
This is only possible it the Frank!Framework is running with Hazelcast. 

If the Frank!Flow is running on a different host (or without Hazelcast), it will need to know the location of the configuration files.
This can be done by setting the `configurations.directory` environment variable.

#### ☕ Run with Java

If you want to run the Frank!Flow with Java, you can download the [Frank!Flow WAR](https://nexus.frankframework.org/#browse/browse:frank-flow:org%2Ffrankframework%2Ffrank-flow) and run it with the following command:
```shell
java -jar frank-flow-<version>.war
```

#### 🐋 Run with Docker

The Frank!Flow can be run with Docker. An image is available on Docker Hub at [frankframework/frank-flow](https://hub.docker.com/r/frankframework/frank-flow).

If a Frank is running on the same host and with Hazelcast, you can use the following command:
```shell
docker run \
  -p 8080:8080 \
  -v <path-to-frank>:/opt/frank \
  frankframework/frank-flow
```
Notice how you still need to mount the configuration files.

A docker compose file using Hazelcast is available in the [docker-compose.yml](https://github.com/ibissource/frank-flow/blob/master/docker-compose.yml) file.

If no Frank is running on the same host or with Hazelcast, you can use the following command:
```shell
docker run \
  -p 8080:8080 \
  -v <path-to-frank>:/opt/frank \
  -e configurations.directory=/opt/frank/configurations \
  frankframework/frank-flow
```

#### 🐆 Run on tomcat

The Frank!Flow can be run on Tomcat.
Place the [Frank!Flow WAR](https://nexus.frankframework.org/#browse/browse:frank-flow:org%2Ffrankframework%2Ffrank-flow) in the `webapps` folder of Tomcat.

If a Frank is running on the same host, it will be able to figure out the location of the configuration files.

## Developing the Frank!Flow

This project consists of two main parts: The Angular (TypeScript) frontend and the Java backend.

### Preparations

#### Requirements

There are some basic requirements that are needed to test or develop the Frank!Flow application. These requirements are:

##### Backend

- [Java](https://www.java.com/nl/download/)
- [Maven](http://maven.apache.org/)

##### Frontend

- [Node.js](https://nodejs.org/en/)

#### DevTools

There are some tools that have to be used during development. 
These tools are needed for linters that keep the code clean and formatted the same way. 
The tools get run automatically by a Git hook.

To install the tools go to the folder `frontend/src/main/frontend`. 
Run `npm install` in this folder and everything should be good to go. 
This is needed because of the way this repo contains the frontend and the backend.

### Frontend

The code for the frontend is located at `frontend/src/main/frontend`. 
This folder contains the cypress integration tests, the source files for the application and configurations. 

#### Serving the frontend

The frontend can be served by running `npm run start` in the `frontend/src/main/frontend` folder.

#### Building the frontend

There are two ways to build the application, for development and for production.

Run `npm run build:dev` or `npm run watch` if you want to build a development build.
The code won’t be minified which will make it easier to debug.

Run `npm run build:prod` or [building the whole application](#building-the-whole-application) if you want to build a production build.

#### Analyze build

To analyze the size of the build and which files are making it so big, run `npm run build:analyze`.

### Backend

The backend is used as an API for getting files from the file-system. The code is located at `frank-flow/src/main/java`.

#### Running the backend

The backend can be run with the Spring Boot Initializer.
Run `mvn spring-boot:run` in the `frank-flow/src/main/java` folder.

##### Building the backend

Run `mvn install` in the `frank-flow` folder.

##### Building the whole application

Run `mvn install` to build the whole application. 
This command builds both the backend and the frontend.

### Configuration

The Frank!Flow has some configuration options which are mainly used for the backend. 
The configuration options can be set by placing them in a `applications.properties` file. 
Every property should be on its own line and be followed by an equals sign (`=`) and a value. 
The properties file should be placed in the location from where the Frank!Flow gets start. 
While developing with the Frank!Runner this would be in the root of the folder `frank-runner`.

| Property                   | Description                                   | Default value |
|----------------------------|-----------------------------------------------|---------------|
| `frank-flow.port`          | The port which the embedded Tomcat should use | `8080`        |
| `configurations.directory` | The directory location of the Frank!Configs   | _empty_       |
