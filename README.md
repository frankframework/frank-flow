# frank-flow
Graphical flow editor for Frank configurations

This project will help you visualize your adapters in flow format.

The project has been tested in firefox, other browsers will give an inacurate representation of the editor.

# To integrate the frank-flow: 
  <li>
  Clone this project and place it inside your own ibis project.
  </li>
  <li>
  Put the files inside of the folder webapp/ibis (or just webapps in case you have no ibis folder).
  If you have multiple webapp folders then put it in the src/main/webapp folder.
  </li>
  <img src="media/frankflowDownloadTut.png" />
  <li>
  Start your ibis.
  </li>
  <li>
  Navigate to the url http://localhost/ibis/frank-flow/.
  If the url isn't working, look good at your file structure. The url is dependant on the map you put it in.
  </li>
  <img src="media/frankFlowMain.png" />

# How to use the frank-flow
  
  <li>
  All of your configurations will be in the dropdown menu, select a name and that configuration will load.
  </li>
  <br>
  <li>
  The hamburger menu has some functionalities:
  </li>
  <li>
  change lines: change the connection type between your pipes.
  </li>
  <li>
  generate flow: the flow will generate when you type in the editor or click on the editor but clicking this button will also generate the flow for you.
  </li>
  <li>
  toggle horizontal: clicking this button wil toggle between horizontal flow generation and vertical flow generation.
  </li>
  <li>
  run xsd: clicking this button will run the official ibis xsd against your code. Invalid XML will be shown with red marking in your editor.
  </li>
  <li>
  beautify: beautify your code.
  </li>
  <li>
  download: download your flowchart as an svg.
  </li>
  
  # Autocomplete
  The editor also supports autocomplete. (WARNING: this feature is not complete yet)
  
  # IMPORTANT
  Your configuration must be in beautiful syntax, otherwise it may not load. 
  If your configuration has multiple adapters note that there are still bugs with doing actions like adding forwards.
