# Frank!Flow

_Graphical flow editor for Frank configurations._

This project will help you visualize and edit your adapters in a flow format. The configurations should be in the “beautiful” syntax.

The project has been tested in Mozilla Firefox and Google Chrome, other browsers will possibly give an inaccurate representation of the editor.

## How to use the Frank!Flow

### Explorer 📁

The explorer is presented on the left side of the window. The explorer will help you to browse configurations, add, rename and delete them. The file-tree is a representation of the file system where your configurations are located.

There are two buttons located above the file-tree. The first one is for adding a new configuration and the second one is to save the current selected configuration. 

You can select a configuration by clicking on it. The flow will be loaded on the white canvas. Two additional options will be provided by right-clicking a file: Rename and delete.

### Palette 🎨

The palette contains all the usable pipes and validators out of which the adapters are build. The pipes can be searched and are categorized respectively.

The pipe will be added to the canvas by clicking on it.

### Flow 🔌

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

### Pipe options 🎛

You can select a pipe by clicking it on the canvas. The options of the pipe can than be changed at the bottom of the screen. There are a number of tabs splitting the options in a organized manner.

### Editor ⌨

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

