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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.frankframework.frankflow.dto.ConfigurationDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ConfigurationApi {

	@Autowired
	private Configurations configurations;

	@GetMapping(value = "/configurations", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> getConfigurations() {
		return ResponseEntity.status(HttpStatus.OK).body(configurations.getAllConfigurations());
	}

	@GetMapping(value = "/configurations/{name}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> getConfigurations(@PathVariable("name") String configurationName) {
		ConfigurationDTO config = configurations.getConfiguration(configurationName);

		if(StringUtils.isEmpty(config.getDirectory())) {
			throw new ApiException("configuration is not readable/writable");
		}

		File dir = new File(config.getDirectory());
		return ResponseEntity.status(HttpStatus.OK).body(readDirectory(dir));
	}

	private static Map<String, Object> readDirectory(File directory) {
		Map<String, Object> methodBuilder = new HashMap<>();
		ArrayList<String> files = new ArrayList<String>();
		for(File file : directory.listFiles()) {
			if(file.isDirectory()) {
				methodBuilder.put(file.getName(), readDirectory(file));
			} else {
				files.add(file.getName());
			}
		}
		if(!files.isEmpty())
			methodBuilder.put("_files", files);

		return methodBuilder;
	}
}
