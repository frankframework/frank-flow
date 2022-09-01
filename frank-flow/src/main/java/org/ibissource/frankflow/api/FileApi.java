/*
Copyright 2020 WeAreFrank!

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package org.ibissource.frankflow.api;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.ReadOnlyFileSystemException;
import java.nio.file.StandardCopyOption;


import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.PUT;
import javax.ws.rs.PATCH;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.FormParam;
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

	@PUT
	@Path("/")
	@Produces(MediaType.APPLICATION_JSON)
	public Response createFolder(@PathParam("name") String configurationName, @QueryParam("path") String path,  MultipartBody inputDataMap) {

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

			
			try (InputStream is = fileAttachment.getObject(InputStream.class)) {
				Files.copy(is, file.toPath(), StandardCopyOption.REPLACE_EXISTING);
				return Response.status(Response.Status.OK).tag(eTag).build();
			} catch (IOException e) {
				throw new ApiException("An error occurred while saving file ["+path+"]", e);
			}
		}


		return Response.status(Response.Status.OK).build();
	}

	@PATCH
    @Path("/")
    @Produces(MediaType.APPLICATION_JSON)
    public Response renameFolder(@PathParam("name") String configurationName, @QueryParam("path") String path, @FormParam("newName") String newName) {

        if(newName == null || newName.equals("")) {
            throw new ApiException("An unexpected error occurred, property [newName] does not exist or is empty");
        }


        File rootFolder = FileUtils.getDir(configurationName);
        File file = getFile(rootFolder, path);

		if(path.contains("/")) {
			path = path.replaceFirst("(?<=/?.{0,10}/)[^/]*(?!/)$", newName);
		} else {
			path = newName;
		}

        File destFile = getFile(rootFolder, path);

        if(!file.exists()) {
			return Response.status(Response.Status.NOT_FOUND).build();
		}
        if(file.isDirectory()) {
			return Response.status(Response.Status.BAD_REQUEST).build();
		}


        if(file.renameTo(destFile)) {
		    return Response.status(Response.Status.OK).entity(path).type(MediaType.TEXT_PLAIN).build();
        } else {
            throw new ApiException("An unexpected error occurred, file can't be renamed");
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
			throw new ApiException("File already exists", Response.Status.CONFLICT);
		}

		try (InputStream is = fileAttachment.getObject(InputStream.class)) {
			Files.copy(is, file.toPath(), StandardCopyOption.REPLACE_EXISTING);

			// the file should always exist, lets make sure though, you never know...
			if(file.exists()) {
				EntityTag eTag = new EntityTag("lm"+file.lastModified());
				return Response.status(Response.Status.OK).tag(eTag).build();
			}
			throw new ApiException("An unexpected error occurred, file ["+path+"] does not exists");
		} catch (IOException e) {
			throw new ApiException("An error occurred while creating file ["+path+"]", e);
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
			throw new ApiException("Unable to remove file ["+path+"]");
		}
	}

	/**
	 * Check if file is accessible and is a child of the rootFolder (eq. no ../ in path)
	 */
	private File getFile(File rootFolder, String path) {
		if(path == null) {
			throw new ApiException("No (valid) path specified");
		}

		File file = new File(rootFolder, path);
		String normalizedFilename = FilenameUtils.normalize(file.getAbsolutePath());
		if(normalizedFilename == null) { //non absolute path, perhaps ../ is used?
			throw new ApiException("Unable to determine normalized filename");
		}
		else if(normalizedFilename.equals(file.getPath())) {
			return file;
		}

		throw new ApiException("Inaccessible path ["+file+"]");
	}
}
