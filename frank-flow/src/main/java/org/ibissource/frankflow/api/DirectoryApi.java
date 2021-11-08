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

import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.util.StringUtils;

import org.apache.commons.io.FilenameUtils;
import org.ibissource.frankflow.util.FileUtils;

@Path("/configurations/{name}/directories")
public class DirectoryApi {
	private static final Logger log = LogManager.getLogger(FileUtils.class);
	public static final String BASE_DIR = System.getProperty("configurations.directory");

    @POST
    @Path("/")
    @Produces(MediaType.APPLICATION_JSON)
    public Response makeDirectory(@PathParam("name") String configurationName, @QueryParam("path") String path) {
        log.info("Post to directories");
        System.out.println("Post to directories!");
        File rootFolder = FileUtils.getDir(configurationName);
        File file = getFile(rootFolder, path);

        if(file.exists()) {
            return Response.status(Response.Status.BAD_REQUEST).build();
        }
        if(FileUtils.createDir(file)) {
            return Response.status(Response.Status.OK).build();
        } else {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).build();
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
