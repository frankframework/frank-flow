/*
   Copyright 2020 - 2024 WeAreFrank!

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

import org.apache.commons.io.FilenameUtils;
import org.ibissource.frankflow.util.FileUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DirectoryApi {

	@PostMapping(value = "/configurations/{name}/directories", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> makeDirectory(@PathVariable("name") String configurationName, @RequestParam("path") String path) {
		File rootFolder = FileUtils.getDir(configurationName);
		File file = getFile(rootFolder, path);

		if(file.exists()) {
			throw new ApiException("Directory already exists", HttpStatus.CONFLICT);
		}
		if(FileUtils.createDir(file)) {
			return ResponseEntity.status(HttpStatus.CREATED).build();
		} else {
			throw new ApiException("Could not create directory", HttpStatus.CONFLICT);
		}

	}

	@PatchMapping(value = "/configurations/{name}/directories", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> renameFolder(@PathVariable("name") String configurationName, @RequestParam("path") String path, @RequestPart("newName") String newName) {
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
			return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
		}
		if(!file.isDirectory()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
		}

		if(file.renameTo(destFile)) {
			return ResponseEntity.status(HttpStatus.OK).contentType(MediaType.TEXT_PLAIN).body(path);
		} else {
			throw new ApiException("An unexpected error occurred, directory can't be renamed");
		}
	}

	@DeleteMapping(value = "/configurations/{name}/directories", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> deleteDirectory(@PathVariable("name") String configurationName, @RequestParam("path") String path) {
		File rootFolder = FileUtils.getDir(configurationName);
		File file = getFile(rootFolder, path);

		if(!file.exists()) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
		}
		if(!file.isDirectory()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
		}

		if(file.delete()) {
			return ResponseEntity.status(HttpStatus.OK).build();
		} else {
			if(Objects.requireNonNull(file.listFiles()).length > 0) {
				throw new ApiException("Can't delete directory '" + path + "' with content. Please remove the content first.");
			}
			throw new ApiException("Unable to remove directory [" + path + "]");
		}
	}

	/**
	 * Check if file is accessible and is a child of the rootFolder (eq. no ../ in
	 * path)
	 */
	private File getFile(File rootFolder, String path) {
		if(path == null) {
			throw new ApiException("No (valid) path specified");
		}

		File file = new File(rootFolder, path);
		String normalizedFilename = FilenameUtils.normalize(file.getAbsolutePath());
		if(normalizedFilename == null) { // non absolute path, perhaps ../ is used?
			throw new ApiException("Unable to determine normalized filename");
		} else if(normalizedFilename.equals(file.getPath())) {
			return file;
		}

		throw new ApiException("Inaccessible path [" + file + "]");
	}
}
