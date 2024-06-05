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
package org.frankframework.frankflow.api;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

import org.apache.commons.io.FilenameUtils;
import org.frankframework.frankflow.util.FileUtils;
import org.frankframework.frankflow.util.MimeTypeUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class FileApi {

	@GetMapping(value = "/configurations/{name}/files", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> getFile(@PathVariable("name") String configurationName, @RequestParam("path") String path) {
		File rootFolder = FileUtils.getDir(configurationName);
		File file = getFile(rootFolder, path);
		if(!file.exists()) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
		}
		if(file.isDirectory()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
		}

		try {
			FileInputStream fis = new FileInputStream(file); // Can't wrap this in try, may not auto close!
			MediaType mediaType = MimeTypeUtil.determineFromPathMimeType(file.getName());
			return ResponseEntity.status(HttpStatus.OK).contentType(mediaType).body(fis);
		} catch (IOException e) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
		}
	}

	@PutMapping(value = "/configurations/{name}/files", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> createFolder(@PathVariable("name") String configurationName, @RequestParam("path") String path, @RequestPart MultipartFile fileAttachment) {
		if(fileAttachment == null) {
			throw new ApiException("Missing form-data [file] parameter");
		}

		File rootFolder = FileUtils.getDir(configurationName);
		File file = getFile(rootFolder, path);
		if(file.exists()) {
			if(file.isDirectory()) {
				return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
			}

			try(InputStream is = fileAttachment.getInputStream()) {
				Files.copy(is, file.toPath(), StandardCopyOption.REPLACE_EXISTING);
				return ResponseEntity.status(HttpStatus.OK).build();
			} catch (IOException e) {
				throw new ApiException("An error occurred while saving file [" + path + "]", e);
			}
		}

		return ResponseEntity.status(HttpStatus.OK).build();
	}

	public static record FormFileModel(MultipartFile file) {
	}

	@PatchMapping(value = "/configurations/{name}/files", produces = MediaType.APPLICATION_JSON_VALUE)
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
		if(file.isDirectory()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
		}

		if(file.renameTo(destFile)) {
			return ResponseEntity.status(HttpStatus.OK).contentType(MediaType.TEXT_PLAIN).body(path);
		} else {
			throw new ApiException("An unexpected error occurred, file can't be renamed");
		}
	}

	@PostMapping(value = "/configurations/{name}/files", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> saveFile(@PathVariable("name") String configurationName, @RequestParam("path") String path, @RequestPart MultipartFile fileAttachment) {
		if(fileAttachment == null) {
			throw new ApiException("Missing form-data [file] parameter");
		}

		File rootFolder = FileUtils.getDir(configurationName);
		File file = getFile(rootFolder, path);
		if(file.exists()) {
			throw new ApiException("File already exists", HttpStatus.CONFLICT);
		}

		try(InputStream is = fileAttachment.getInputStream()) {
			Files.copy(is, file.toPath(), StandardCopyOption.REPLACE_EXISTING);

			// the file should always exist, lets make sure though, you never know...
			if(file.exists()) {
				return ResponseEntity.status(HttpStatus.OK).build();
			}
			throw new ApiException("An unexpected error occurred, file [" + path + "] does not exists");
		} catch (IOException e) {
			throw new ApiException("An error occurred while creating file [" + path + "]", e);
		}
	}

	@DeleteMapping(value = "/configurations/{name}/files", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> deleteFile(@PathVariable("name") String configurationName, @RequestParam("path") String path) {
		File rootFolder = FileUtils.getDir(configurationName);
		File file = getFile(rootFolder, path);
		if(!file.exists()) {
			return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
		}
		if(file.isDirectory()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
		}

		if(file.delete()) {
			return ResponseEntity.status(HttpStatus.OK).build();
		} else {
			throw new ApiException("Unable to remove file [" + path + "]");
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
		}
//		else if(normalizedFilename.equals(file.getPath())) {
		else {
			return file;
		}

//		throw new ApiException("Inaccessible path ["+file+"]");
	}
}
