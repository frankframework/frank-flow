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

* You can move the pipes by dragging them around.
* A forward can be created by dragging from the edge of the first pipe, to the edge of the second pipe. While dragging you can see an arrow, pointing in the direction of the forward.

Besides dragging and clicking the pipes, there are some additional options in the right-click menu:

* Toggle activity mode: The pipes will change to a simpler and compacter appearance by clicking this option.
* Realign flow: You can reset the flow to a generated flow.
* Toggle curve: Change the angled lines to curves.
* Toggle flow direction: Change to flow from vertical to horizontal mode.
* Export SVG: This option will export an SVG image of the part of the canvas you are looking at.

There are two more options that will be discussed in the further chapters.

### 🎛 Pipe options

You can select a pipe by clicking it on the canvas. The options of the pipe can than be changed at the bottom of the screen. There are a number of tabs splitting the options in a organized manner.

### ⌨ Editor

While the flow can help you manipulate your adapter, there are still some people that want some more control or are used to editing the adapter in XML-code.

The editor can be opened by right-clicking the canvas and selecting “toggle editor”.

The editor has some special features:

* The editor has autocompletion for the pipes.

* The editor can highlight the selected pipe on the canvas.

* Errors will be shown with red lines and messages in the editor.

#### Autocompletion

The XML autocompletion is custom made for the Frank!Flow and is made available for everybody that wants XML completion with the Monaco-editor. Like this project it is open-source and to be found on Github:  https://github.com/philipsens/monaco-xsd-code-completion

The autocompletion has support for multiple XSD’s, namespaces and isn’t just limited to the ibisdoc. Just place the XSD in the configuration folder and reference it in the configuration to add autocompletion.

#### Validation

The editor will show errors and validate your configuration in the future.  

## Testing and Developing

### Frank!Runner

The easiest way to get started with the Frank!Flow is with help of the Frank!Runner. Look here to get up and started with the Frank!Runner: https://github.com/ibissource/frank-runner. You can skip this if you already have a Frank!Runner.

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

You should edit `PATH_TO_YOUR_FRANK-FLOW_PROJECT` to the correct location. As you can see, the rest of the path contains the location to the frontend dist folder.

### Restart

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



