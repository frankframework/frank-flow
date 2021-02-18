# Frank!Flow 2.0!

The Frank!Flow application is currently undergoing a renovation. The application will mostly be rewritten to Angular for a better User Experience and a stable product.

The current version of this application is considered a Work In Progress. Go to the [1.0.x](https://github.com/ibissource/frank-flow/tree/1.0.x) branch if you want to use the sable release.

# Frank!Flow

_Graphical flow editor for Frank configurations._

This project will help you visualize and edit your adapters in a flow format. The configurations should be in the “beautiful” syntax.

The project has been tested in Mozilla Firefox and Google Chrome, other browsers will possibly give an inaccurate representation of the editor.

## How to use the Frank!Flow

### 📁 Explorer

The explorer is presented on the left side of the window. The explorer will help you to browse configurations, add, rename and delete them. The file-tree is a representation of the file system where your configurations are located.

There are two buttons located above the file-tree. The first one is for adding a new configuration and the second one is to save the current selected configuration.

You can select a configuration by clicking on it. The flow will be loaded on the white canvas. Two additional options will be provided by right-clicking a file: Rename and delete.

### 🎨 Palette

The palette contains all the usable pipes and validators out of which the adapters are build. The pipes can be searched and are categorized respectively.

The pipe will be added to the canvas by clicking on it.

### 🔌 Flow

The flow is the main attraction of the application and has a lot of hidden features. There are a number of ways to manipulate the flow:

- You can move the pipes by dragging them around.
- A forward can be created by dragging from the edge of the first pipe, to the edge of the second pipe. While dragging you can see an arrow, pointing in the direction of the forward.

Besides dragging and clicking the pipes, there are some additional options in the right-click menu:

- Toggle activity mode: The pipes will change to a simpler and compacter appearance by clicking this option.
- Realign flow: You can reset the flow to a generated flow.
- Toggle curve: Change the angled lines to curves.
- Toggle flow direction: Change to flow from vertical to horizontal mode.
- Export SVG: This option will export an SVG image of the part of the canvas you are looking at.

There are two more options that will be discussed in the further chapters.

### 🎛 Pipe options

You can select a pipe by clicking it on the canvas. The options of the pipe can than be changed at the bottom of the screen. There are a number of tabs splitting the options in a organized manner.

### ⌨ Editor

While the flow can help you manipulate your adapter, there are still some people that want some more control or are used to editing the adapter in XML-code.

The editor can be opened by right-clicking the canvas and selecting “toggle editor”.

The editor has some special features:

- The editor has autocompletion for the pipes.
- The editor can highlight the selected pipe on the canvas.
- Errors will be shown with red lines and messages in the editor.

#### Autocompletion

The XML autocompletion is custom made for the Frank!Flow and is made available for everybody that wants XML completion based on XSD’s for the Monaco Editor. Like this project, it is open-source and can be found [here on Github](https://github.com/philipsens/monaco-xsd-code-completion).

The autocompletion has support for multiple XSD’s, namespaces and isn’t just limited to the IbisDoc. Just place the XSD in the configuration folder and reference it in the configuration to add autocompletion.

#### Validation

The editor will show errors and validate your configuration in the future.

## Testing and Developing

### Frank!Runner

The easiest way to get started with the Frank!Flow is with help of the [Frank!Runner](https://github.com/ibissource/frank-runner). You can skip this if you already have a Frank!Runner.

### Frank2Frank!Flow

Create a new frank folder next to the frank-runner folder. Following the name convention this should be called `frank2frank-flow`. This folder will contain three main files and an optional file to restart the runner.

#### POM

The POM will tell the Frank!Runner which extra dependencies you want to download. In this case we want the artifact “frank-flow”. Create a file called `pom.xml` and place the following text in it:

```XML
<project
    xmlns="http://maven.apache.org/POM/4.0.0"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd"
    >
    <modelVersion>4.0.0</modelVersion>

    <groupId>org.ibissource</groupId>
    <artifactId>frank2frank-flow</artifactId>
    <version>1.0</version>
    <packaging>war</packaging>

    <dependencies>
        <dependency>
            <groupId>org.ibissource</groupId>
            <artifactId>ibis-adapterframework-webapp</artifactId>
            <version>[7.6,)</version>
            <type>war</type>
        </dependency>
        <dependency>
            <groupId>org.ibissource</groupId>
            <artifactId>frank-flow</artifactId>
            <version>0.0.1-SNAPSHOT</version>
        </dependency>
    </dependencies>

    <repositories>
        <repository>
            <id>ibissource</id>
            <name>Ibissource</name>
            <url>https://nexus.ibissource.org/content/repositories/public</url>
        </repository>
    </repositories>

</project>
```

#### Frank!Runner properties

To tell the Frank!Runner we want to download extra dependencies with maven, we have to create a new file called `frank-runner.properties` with the content: `maven=true`.

#### Build

##### Testing

The build file is needed to tell the Frank!Runner where our frank is located. Create a file called `build.xml` and paste the following text in it:

```XML
<project default="restart-frank2frank-flow">
	<target name="restart-frank2frank-flow">
		<basename property="project.dir" file="${basedir}"/>
		<exec executable="../frank-runner/restart.bat" vmlauncher="false" failonerror="true">
			<arg value="-Dproject.dir=${project.dir}"/>
		</exec>
	</target>
</project>
```

##### Development

If you’d like to develop the Frank!Flow it would be handy to store the Frank!Flow project in a different location than your franks. To tell the Frank!Runner that our Frank!Flow project is located at a different location, we need to add an extra argument to the build.xml. This extra argument can be seen on line 6:

```XML
<project default="restart-frank2frank-flow">
	<target name="restart-frank2frank-flow">
		<basename property="project.dir" file="${basedir}"/>
		<exec executable="../frank-runner/restart.bat" vmlauncher="false" failonerror="true">
			<arg value="-Dproject.dir=${project.dir}"/>
			<arg value="-Dfrank-flow.frontend.path=C:\PATH_TO_YOUR_FRANK-FLOW_PROJECT\frank-flow\src\main\resources\frontend"/>
		</exec>
	</target>
</project>
```

You should edit `PATH_TO_YOUR_FRANK-FLOW_PROJECT` to the correct location. As you can see, the rest of the path contains the location to the frontend distribution folder.

#### Restart

The last file is optional, because it is up to you how you restart your Frank!Runner. Some people like to use the build in Task Manager of there IDE, which will have a restart task because of the build.xml.

You could also create an additional `restart.bat` so it can be called via the command line interface (or double click). This file should contain:

```bash
call ..\frank-runner\ant.bat
if %errorlevel% equ 0 goto end
rem https://superuser.com/questions/527898/how-to-pause-only-if-executing-in-a-new-window
set arg0=%0
if [%arg0:~2,1%]==[:] if not [%TERM_PROGRAM%] == [vscode] pause
:end
```

### Frank!Flow

Clone this repository (or a fork) to start developing the Frank!Flow. This project consists of two main parts: The JavaScript frontend and the Java backend.

#### Requirements

There are some basic requirements that are needed to test or develop the Frank!Flow application. These requirements are:

- [Java](https://www.java.com/nl/download/)
- [Node.js](https://nodejs.org/en/)
- [Maven](http://maven.apache.org/)

#### Frontend

The code for the frontend is located at `frank-flow/src/forntend`. The most important files in this folder are the index.html which bootstraps the application and the app folder which contains all the logic off the application. Some other notable folders are: css for the stylesheets, media for images and recourses and test for the Karma tests.

##### Developing the frontend

Start by installing the node modules with the command `npm install`. This will download the required packages that the Frank!Flow depends on. Some of these packages are: jsPlumb for the flow canvas and Monaco-editor for the build in editor.

After installing the node_modules you can start coding! You can automatically build the files while you are editing by using the command `npm run watch`, however you will need to refresh the browser yourself.

##### Building the frontend

There are two ways to build the application, for development and for production. The difference lays in the build target and build mode.

The development build points to the `frank-flow/src/main/resources/frontend` folder. This folder can then be used by Frank2Frank!Flow to serve the frontend. The code won’t be minified which will make it easier to debug. The development build will also contain a stats.json which contains information about the build files and their size. You can make a development build by running the command `npm run build-dev` or `npm run watch`. After running this command you can use `npm run bundle-report` to get a tree view diagram of the bundled files.

The production build points to the `frank-flow/target/frontend` folder. This folder will contain minified files to lower the size of the build. This folder will be used when building the whole application (backend and frontend) and will be included in the frank-flow.jar. You can make a production build by running the command `npm run build` or by [building the whole application](#building-the-whole-application).

#### Backend

The backend is used to serve the frontend and as an API for getting files from the filesystem. The code is located at `frank-flow/main/java`.

##### Building the whole application

There are two simple ways to build the backend, for local and server use.

The easiest option while developing is to just run `mvn install`. This will install some plugins and bundle the files into the Jar. This command will also copy the frontend into the Jar if ran the [build command](#building-the-frontend). While technically you could build the Jar without the frontend, there really isn’t a reason not to, apart from testing the API only. Copying the frontend will be close to instant after the first build, as long as the build folder doesn’t change, because the target folder is cached.

The other option is meant for a production setting. This is because Maven will also install Node.js and NPM for building the frontend. This way is compatible with the Jenkins automation server. The build can be started by running `mvn install -P frontend`.

## Other projects

- [Frank!Runner](https://github.com/ibissource/frank-runner)
- [XSD code completion for the Monaco Editor](https://github.com/philipsens/monaco-xsd-code-completion)
