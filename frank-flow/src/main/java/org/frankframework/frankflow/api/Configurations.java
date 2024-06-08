/*
   Copyright 2024 WeAreFrank!

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

import java.util.ArrayList;
import java.util.List;

import org.frankframework.frankflow.dto.ConfigurationDTO;
import org.frankframework.management.bus.BusAction;
import org.frankframework.management.bus.BusMessageUtils;
import org.frankframework.management.bus.BusTopic;
import org.frankframework.management.bus.OutboundGateway;
import org.frankframework.util.JacksonUtils;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.SessionScope;

/**
 * Lazy-loaded class that contains all Configurations, HTTP Session scoped.
 * Connects to the bus (only-once) in order to retrieve all configurations.
 * 
 * By default the Frank!Framework configurations are omitted.
 * 
 * @author Niels Meijer
 */
@Component
@SessionScope
public class Configurations implements InitializingBean {
	private static final String DEFAULT_FF_CONFIGURATION_PREFIX = "IAF_";

	private List<ConfigurationDTO> configurations = new ArrayList<>();

	@Autowired
	private OutboundGateway gateway;


	@Override
	public void afterPropertiesSet() throws Exception {
		Message<String> request = MessageBuilder.withPayload("NONE").setHeader(BusTopic.TOPIC_HEADER_NAME, BusTopic.CONFIGURATION.name()).setHeader(BusAction.ACTION_HEADER_NAME, BusAction.FIND.name()).build();

		Message<Object> response = gateway.sendSyncMessage(request);
		List<ConfigurationDTO> configs = getConfigurations(response);

		configurations = configs.stream().filter(e -> !e.getName().startsWith(DEFAULT_FF_CONFIGURATION_PREFIX)).toList();
	}

	private List<ConfigurationDTO> getConfigurations(Message<?> response) {
		if(MediaType.APPLICATION_JSON_VALUE.equals(response.getHeaders().get(BusMessageUtils.HEADER_PREFIX+"type"))) {
			ConfigurationDTO[] arr = JacksonUtils.convertToDTO(response.getPayload(), ConfigurationDTO[].class);
			return List.of(arr); //TODO new TypeReference<List<ConfigurationDTO>>(){}
		}

		throw new ApiException("unexpected result returned by Bus");
	}

	public List<String> getAllConfigurations() {
		return configurations.stream().map(ConfigurationDTO::getName).toList();
	}

	public ConfigurationDTO getConfiguration(String name) {
		return configurations.stream()
				.filter(e -> e.getName().equals(name))
				.findFirst()
				.orElseThrow(() -> new ApiException("configuration not found", HttpStatus.NOT_FOUND));
	}
}
