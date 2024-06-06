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
import java.util.List;
import java.util.Map;

import org.frankframework.frankflow.dto.ConfigurationDTO;
import org.frankframework.frankflow.util.FileUtils;
import org.frankframework.management.bus.BusAction;
import org.frankframework.management.bus.BusMessageUtils;
import org.frankframework.management.bus.BusTopic;
import org.frankframework.management.bus.OutboundGateway;
import org.frankframework.util.JacksonUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ConfigurationApi {
	private static final String DEFAULT_FF_CONFIGURATION_PREFIX = "IAF_";

	@Autowired
	private OutboundGateway gateway;

	@GetMapping(value = "/configurations", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> getConfigurations() {
		Message<String> request = MessageBuilder.withPayload("NONE").setHeader(BusTopic.TOPIC_HEADER_NAME, BusTopic.CONFIGURATION.name()).setHeader(BusAction.ACTION_HEADER_NAME, BusAction.FIND.name()).build();

		Message<Object> response = gateway.sendSyncMessage(request);
		List<ConfigurationDTO> configs = getConfigurations(response);
		List<String> configurations = new ArrayList<>();
		for(ConfigurationDTO config : configs) {
			if(!config.getName().startsWith(DEFAULT_FF_CONFIGURATION_PREFIX)) {
				configurations.add(config.getName());
			}
		}

		return ResponseEntity.status(HttpStatus.OK).body(configurations);
	}

	@SuppressWarnings("unchecked")
	private List<ConfigurationDTO> getConfigurations(Message<?> response) {
		if(MediaType.APPLICATION_JSON_VALUE.equals(response.getHeaders().get(BusMessageUtils.HEADER_PREFIX+"type"))) {
			ConfigurationDTO[] arr = JacksonUtils.convertToDTO(response.getPayload(), ConfigurationDTO[].class);
			return List.of(arr); //TODO new TypeReference<List<ConfigurationDTO>>(){}
		} else if(response.getPayload() instanceof List configs) {
			return configs;
		}
		throw new ApiException("unexpected result returned by Bus");
	}

	@GetMapping(value = "/configurations/{name}", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<?> getConfigurations(@PathVariable("name") String configurationName) {
		File dir = FileUtils.getDir(configurationName);

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
