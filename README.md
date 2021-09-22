# Frank!Flow

_Graphical flow editor for Frank configurations._

This project will help you visualize and edit your adapters in a flow format. The configurations should be in the “beautiful” syntax.

The project has been tested in Mozilla Firefox and Google Chrome, other browsers will possibly give an inaccurate representation of the editor. If you'd like to report a bug, you can do so [here](https://github.com/ibissource/frank-flow/issues/new?assignees=&labels=bug&template=bug_report.md).

## Features of the Frank!Flow

First of all, the Frank!Flow consists of three 'modes' of 'views'. These are: Editor, Flow and Hybrid. Each of the modes focus on a specific use case, like editing visually or programatically. The modes are made with usability in mind, which means that the Flow is the most simple and the Editor is the most advanced.

### 📁 Explorer

The Explorer is presented in the middle of the top-bar as a drop down menu (regardless of which mode you're in) and presents the current configuration. The Explorer is also presented on left side of the window when in Editor mode. The explorer will help you to browse configurations, add, ~~rename~~ and delete them. The Explorer is a representation of the file system where your configurations are located.

There are some buttons associated with the Explorer that will perform actions on the file system. Two buttons are located on the header and are used for adding a configuration and saving the current configuration (respectively). The Three buttons above the Explorer in Editor mode are used for adding and deleting a configuration as well as refreshing the Explorer (handy when files changed on the system). A file can be added to a sub-folder, by selecting the folder first (marking it blue).

You can select a configuration by clicking on it. The Flow will be loaded on the Canvas.

### 🎨 Palette

The palette contains all the usable pipes and validators out of which the adapters are build. The pipes can be searched and are categorized respectively.

The pipe will be added to the canvas by clicking on it.

### 🔌 Flow

The flow is the main attraction of the application and has a lot of hidden features. There are a number of ways to manipulate the flow:

- You can move the pipes by dragging them around.
- A forward can be created by dragging from the bottom circle of the first pipe, to the top circle of the second pipe. While dragging you can see an arrow, pointing in the direction of the forward.
- Double click a forward to remove it.

### 🎛 Pipe options

You can select a pipe by double clicking it on the canvas. The options of the pipe will be opened in a modal in the middle of the screen. In this modal it is possible to add new attributes and edit attributes.

### ⌨ Editor

While the flow can help you manipulate your adapter, there are still some people that want some more control or are used to editing the adapter in XML-code.

#### ~~Autocompletion~~

_Currently unavailable in the Frank!Flow 2.0_

The XML autocompletion is custom made for the Frank!Flow and is made available for everybody that wants XML completion based on XSD’s for the Monaco Editor. Like this project, it is open-source and can be found [here on Github](https://github.com/philipsens/monaco-xsd-code-completion).

The autocompletion has support for multiple XSD’s, namespaces and isn’t just limited to the IbisDoc. Just place the XSD in the configuration folder and reference it in the configuration to add autocompletion.

## How to use the Frank!Flow

The easiest way to use the Frank!Flow is by starting the Frank!Runner with the Frank2Example4 Frank.

_More instructions on running the Frank!Flow in a standalone way or in an existing project will follow._

## Developing the Frank!Flow

_Instructions on developing the Frank!Flow will follow._

## Other projects

- [Frank!Runner](https://github.com/ibissource/frank-runner)
- [XSD code completion for the Monaco Editor](https://github.com/philipsens/monaco-xsd-code-completion)
