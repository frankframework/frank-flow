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
package org.frankframework.frankflow.standalone;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

import org.frankframework.frankflow.dto.ConfigurationDTO;
import org.frankframework.frankflow.util.FileUtils;
import org.frankframework.management.bus.BusAction;
import org.frankframework.management.bus.BusTopic;
import org.frankframework.management.bus.message.JsonMessage;
import org.springframework.context.annotation.Bean;
import org.springframework.integration.core.MessageSelector;
import org.springframework.integration.dispatcher.MessageDispatcher;
import org.springframework.integration.dsl.IntegrationFlow;
import org.springframework.integration.handler.ServiceActivatingHandler;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageHandler;
import org.springframework.stereotype.Component;

import jakarta.annotation.security.RolesAllowed;

/**
 * Logging should work even when the application failed to start which is why it's not wired through the {@link MessageDispatcher}.
 */
@Component
public class ConfigurationsDirectory {

	/**
	 * This method is picked up by the IbisInitializer annotation and autowired via the SpringEnvironmentContext.
	 */
	@Bean
	public IntegrationFlow wireLogging() {
		return IntegrationFlow.from("frank-management-bus")
				.filter(headerSelector(BusTopic.CONFIGURATION, BusTopic.TOPIC_HEADER_NAME))
				.filter(headerSelector(BusAction.FIND, BusAction.ACTION_HEADER_NAME))
				.handle(getHandler()).get();
	}

	public static <E extends Enum<E>> MessageSelector headerSelector(E enumType, String headerName) {
		return message -> {
			String headerValue = (String) message.getHeaders().get(headerName);
			return enumType.name().equalsIgnoreCase(headerValue);
		};
	}

	public MessageHandler getHandler() {
		ServiceActivatingHandler serviceActivator = new ServiceActivatingHandler(this, "getConfigurationsDirectory");
		serviceActivator.setRequiresReply(true);
		return serviceActivator;
	}

	/**
	 * The actual action that is performed when calling the bus with the LOGGING topic.
	 */
	@RolesAllowed({"IbisObserver", "IbisDataAdmin", "IbisAdmin", "IbisTester"})
	public Message<String> getConfigurationsDirectory(Message<?> message) {
		List<ConfigurationDTO> configurations = new ArrayList<>();
		for(File folder : FileUtils.getBaseDir().listFiles()) {
			ConfigurationDTO dto = new ConfigurationDTO();
			dto.setName(folder.getName());
			dto.setDirectory(folder.getAbsolutePath());
			configurations.add(dto);
		}

		return new JsonMessage(configurations);
	}
}
