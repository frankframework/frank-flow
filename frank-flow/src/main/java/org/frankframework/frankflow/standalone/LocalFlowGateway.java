package org.frankframework.frankflow.standalone;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

import org.frankframework.frankflow.dto.ConfigurationDTO;
import org.frankframework.frankflow.util.FileUtils;
import org.frankframework.management.bus.BusMessageUtils;
import org.frankframework.management.bus.OutboundGateway;
import org.springframework.http.MediaType;
import org.springframework.messaging.Message;
import org.springframework.messaging.support.MessageBuilder;

public class LocalFlowGateway implements OutboundGateway {

	@Override
	public <I, O> Message<O> sendSyncMessage(Message<I> in) {
		Message<?> response = MessageBuilder.withPayload(localGatewayImpl()).setHeader(BusMessageUtils.HEADER_PREFIX+"type", MediaType.APPLICATION_OCTET_STREAM_VALUE).build();
		return (Message<O>) response;
	}

	@Override
	public <T> void sendAsyncMessage(Message<T> in) {
		// ignored for now
	}

	public List<ConfigurationDTO> localGatewayImpl() {
		List<ConfigurationDTO> configurations = new ArrayList<>();
		for(File folder : FileUtils.getBaseDir().listFiles()) {
			ConfigurationDTO dto = new ConfigurationDTO();
			dto.setName(folder.getName());
			configurations.add(dto);
		}

		return configurations;
	}
}
