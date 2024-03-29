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
import java.util.Objects;

import javax.ws.rs.PATCH;
import javax.ws.rs.DELETE;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import org.apache.commons.io.FilenameUtils;
import org.ibissource.frankflow.util.FileUtils;

import javax.ws.rs.FormParam;

@Path("/configurations/{name}/directories")
public class DirectoryApi {

    @POST
    @Path("/")
    @Produces(MediaType.APPLICATION_JSON)
    public Response makeDirectory(@PathParam("name") String configurationName, @QueryParam("path") String path) {
        File rootFolder = FileUtils.getDir(configurationName);
        File file = getFile(rootFolder, path);

        if (file.exists()) {
            throw new ApiException("Directory already exists", Response.Status.CONFLICT);
        }
        if (FileUtils.createDir(file)) {
            return Response.status(Response.Status.CREATED).build();
        } else {
            throw new ApiException("Could not create directory", Response.Status.CONFLICT);
        }

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
        if(!file.isDirectory()) {
            return Response.status(Response.Status.BAD_REQUEST).build();
        }

        if(file.renameTo(destFile)) {
            return Response.status(Response.Status.OK).entity(path).type(MediaType.TEXT_PLAIN).build();
        } else {
            throw new ApiException("An unexpected error occurred, directory can't be renamed");
        }
    }

    @DELETE
    @Path("/")
    @Produces(MediaType.APPLICATION_JSON)
    public Response deleteDirectory(@PathParam("name") String configurationName, @QueryParam("path") String path) {
        File rootFolder = FileUtils.getDir(configurationName);
        File file = getFile(rootFolder, path);

        if(!file.exists()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        if(!file.isDirectory()) {
            return Response.status(Response.Status.BAD_REQUEST).build();
        } 
            
        if(file.delete()) {
            return Response.status(Response.Status.OK).build();
        } else {
            if (Objects.requireNonNull(file.listFiles()).length > 0) {
                throw new ApiException("Can't delete directory '"+path+"' with content. Please remove the content first.");
            }
            throw new ApiException("Unable to remove directory ["+path+"]");
        }
    }

    /**
     * Check if file is accessible and is a child of the rootFolder (eq. no ../ in
     * path)
     */
    private File getFile(File rootFolder, String path) {
        if (path == null) {
            throw new ApiException("No (valid) path specified");
        }

        File file = new File(rootFolder, path);
        String normalizedFilename = FilenameUtils.normalize(file.getAbsolutePath());
        if (normalizedFilename == null) { // non absolute path, perhaps ../ is used?
            throw new ApiException("Unable to determine normalized filename");
        } else if (normalizedFilename.equals(file.getPath())) {
            return file;
        }

        throw new ApiException("Inaccessible path [" + file + "]");
    }
}
