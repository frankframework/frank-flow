package org.ibissource.frankflow.api;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

import javax.json.Json;
import javax.json.JsonArray;
import javax.json.JsonArrayBuilder;
import javax.json.JsonObjectBuilder;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import org.ibissource.frankflow.util.FileUtils;

@Path("/configurations")
public class ConfigurationApi {

	@GET
	@Path("/")
	@Produces(MediaType.APPLICATION_JSON)
	public Response getConfigurations() {

		List<String> configurations = new ArrayList<>();
		for(File folder : FileUtils.getBaseDir().listFiles()) {
			configurations.add(folder.getName());
		}

		return Response.status(Response.Status.OK).entity(configurations).build();
	}

	@GET
	@Path("/{name}")
	@Produces(MediaType.APPLICATION_JSON)
	public Response getConfigurations(@PathParam("name") String configurationName) {
		File dir = FileUtils.getDir(configurationName);

		//TODO fix this build.tostring thing
		return Response.status(Response.Status.OK).entity(readDirectory(dir).build().toString()).build();
	}

	public static JsonObjectBuilder readDirectory(File directory) {
		JsonObjectBuilder methodBuilder = Json.createObjectBuilder();
		JsonArrayBuilder files = Json.createArrayBuilder();
		for(File file : directory.listFiles()) {
			if(file.isDirectory()) {
				methodBuilder.add(file.getName(), readDirectory(file));
			} else {
				files.add(file.getName());
			}
		}
		JsonArray filesArray = files.build();
		if(!filesArray.isEmpty())
			methodBuilder.add("_files", filesArray);

		return methodBuilder;
	}
}
