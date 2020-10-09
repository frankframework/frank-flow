package org.ibissource.frankflow.api;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.EntityTag;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Request;
import javax.ws.rs.core.Response;

import org.ibissource.frankflow.util.FileUtils;
import org.ibissource.frankflow.util.MimeTypeUtil;

@Path("/configurations/{name}/files")
public class Files {
	@Context Request request;

	@GET
	@Path("/")
	@Produces(MediaType.APPLICATION_JSON)
	public Response getFile(@PathParam("name") String configurationName, @QueryParam("path") String path) {
		File configurationFolder = FileUtils.getDir(configurationName);
		File file = new File(configurationFolder, path);
		if(!file.exists()) {
			return Response.status(Response.Status.NOT_FOUND).build();
		}
		if(file.isDirectory()) {
			return Response.status(Response.Status.BAD_REQUEST).build();
		}

		Response.ResponseBuilder response = null;
		//Calculate the ETag on last modified date of user resource 
		EntityTag etag = new EntityTag("lm"+file.lastModified());

		//Verify if it matched with etag available in http request
		response = request.evaluatePreconditions(etag);

		//If ETag matches the response will be non-null; 
		if (response != null) {
			return response.tag(etag).build();
		}

		try {
			FileInputStream fis = new FileInputStream(file); //Can't wrap this in try, may not auto close!
			MediaType mediaType = MimeTypeUtil.determineFromPathMimeType(file.getName());
			return Response.status(Response.Status.OK).entity(fis).type(mediaType).tag(etag).build();
		} catch (IOException e) {
			return Response.status(Response.Status.NOT_FOUND).build();
		}
	}
}
