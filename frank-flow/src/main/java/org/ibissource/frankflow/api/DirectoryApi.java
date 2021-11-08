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

@Path("/configurations/{name}/directories")
public class DirectoryApi {

    @POST
    @Path("/")
    @Produces(MediaType.APPLICATION_JSON)
    public Response makeDirectory(@PathParam("name") String configurationName, @QueryParam("path") String path) {
        File rootFolder = FileUtils.getDir(configurationName);
        File file = getFile(rootFolder, path);

        if(file.exists()) {
            throw new ApiException("an unexpected error occured, file ["+path+"] does not exists");
        }
        if(FileUtils.createDir(file)) {
            return Response.status(Response.Status.OK).build();
        } else {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
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
			throw new ApiException("unable to remove file ["+path+"]");
		}
    }

    /**
     * Check if file is accessible and is a child of the rootFolder (eq. no ../ in
     * path)
     */
    private File getFile(File rootFolder, String path) {
        if (path == null) {
            throw new ApiException("no (valid) path specified");
        }

        File file = new File(rootFolder, path);
        String normalizedFilename = FilenameUtils.normalize(file.getAbsolutePath());
        if (normalizedFilename == null) { // non absolute path, perhaps ../ is used?
            throw new ApiException("unable to determine normalized filename");
        } else if (normalizedFilename.equals(file.getPath())) {
            return file;
        }

        throw new ApiException("inaccessible path [" + file + "]");
    }
}
