package org.ibissource.frankflow.api;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.WebApplicationException;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.EntityTag;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Request;
import javax.ws.rs.core.Response;

import org.apache.commons.io.FilenameUtils;
import org.apache.cxf.jaxrs.ext.multipart.Attachment;
import org.apache.cxf.jaxrs.ext.multipart.MultipartBody;
import org.ibissource.frankflow.util.FileUtils;
import org.ibissource.frankflow.util.MimeTypeUtil;

@Path("/configurations/{name}/files")
public class FileApi {
	@Context Request request;

	@GET
	@Path("/")
	@Produces(MediaType.APPLICATION_JSON)
	public Response getFile(@PathParam("name") String configurationName, @QueryParam("path") String path) {
		File rootFolder = FileUtils.getDir(configurationName);
		File file = getFile(rootFolder, path);
		if(!file.exists()) {
			return Response.status(Response.Status.NOT_FOUND).build();
		}
		if(file.isDirectory()) {
			return Response.status(Response.Status.BAD_REQUEST).build();
		}

		Response.ResponseBuilder response = null;
		//Calculate the ETag on last modified date of user resource 
		EntityTag eTag = new EntityTag("lm"+file.lastModified());

		//Verify if it matched with etag available in http request
		response = request.evaluatePreconditions(eTag);

		//If ETag matches the response will be non-null; 
		if (response != null) {
			return response.tag(eTag).build();
		}

		try {
			FileInputStream fis = new FileInputStream(file); //Can't wrap this in try, may not auto close!
			MediaType mediaType = MimeTypeUtil.determineFromPathMimeType(file.getName());
			return Response.status(Response.Status.OK).entity(fis).type(mediaType).tag(eTag).build();
		} catch (IOException e) {
			return Response.status(Response.Status.NOT_FOUND).build();
		}
	}

	@POST
	@Path("/")
	@Produces(MediaType.APPLICATION_JSON)
	public Response saveFile(@PathParam("name") String configurationName, @QueryParam("path") String path, MultipartBody inputDataMap) {
		if(inputDataMap == null) {
			throw new ApiException("Missing form-data post parameters");
		}
		Attachment fileAttachment = inputDataMap.getAttachment("file");
		if(fileAttachment == null) {
			throw new ApiException("Missing form-data [file] parameter");
		}

		File rootFolder = FileUtils.getDir(configurationName);
		File file = getFile(rootFolder, path);
		if(file.exists()) {
			if(file.isDirectory()) {
				return Response.status(Response.Status.BAD_REQUEST).build();
			}
			Response.ResponseBuilder response = null;

			EntityTag eTag = new EntityTag("lm"+file.lastModified());
			response = request.evaluatePreconditions(eTag);

			if (response != null) { //If ETag matches the response will be non-null;
				throw new WebApplicationException(response.build());
			}
		}

		try (InputStream is = fileAttachment.getObject(InputStream.class)) {
			Files.copy(is, file.toPath(), StandardCopyOption.REPLACE_EXISTING);

			// the file should always exists, lets make sure though, you never know...
			if(file.exists()) {
				EntityTag eTag = new EntityTag("lm"+file.lastModified());
				return Response.status(Response.Status.OK).tag(eTag).build();
			}
			throw new ApiException("an unexpected error occured, file ["+path+"] does not exists");
		} catch (IOException e) {
			throw new ApiException("an error occured while saving file ["+path+"]", e);
		}
	}

	@DELETE
	@Path("/")
	@Produces(MediaType.APPLICATION_JSON)
	public Response deleteFile(@PathParam("name") String configurationName, @QueryParam("path") String path) {
		File rootFolder = FileUtils.getDir(configurationName);
		File file = getFile(rootFolder, path);
		if(!file.exists()) {
			return Response.status(Response.Status.NOT_FOUND).build();
		}
		if(file.isDirectory()) {
			return Response.status(Response.Status.BAD_REQUEST).build();
		}

		Response.ResponseBuilder response = null;
		//Calculate the ETag on last modified date of user resource 
		EntityTag eTag = new EntityTag("lm"+file.lastModified());

		//Verify if it matched with etag available in http request
		response = request.evaluatePreconditions(eTag);

		if (response != null) { //If ETag matches the response will be non-null;
			throw new WebApplicationException(response.build());
		}

		if(file.delete()) {
			return Response.status(Response.Status.OK).build();
		} else {
			throw new ApiException("unable to remove file ["+path+"]");
		}
	}

	/**
	 * Check if file is accessible and is a child of the rootFolder (eq. no ../ in path)
	 */
	private File getFile(File rootFolder, String path) {
		if(path == null) {
			throw new ApiException("no (valid) path specified");
		}

		File file = new File(rootFolder, path);
		String normalizedFilename = FilenameUtils.normalize(file.getAbsolutePath());
		if(normalizedFilename == null) { //non absolute path, perhaps ../ is used?
			throw new ApiException("unable to determine normalized filename");
		}
		else if(normalizedFilename.equals(file.getPath())) {
			return file;
		}

		throw new ApiException("inaccessible path ["+file+"]");
	}
}
