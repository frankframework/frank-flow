package org.frankframework.frankflow.dto;

import lombok.Getter;
import lombok.Setter;

public class ConfigurationDTO {

	private @Getter @Setter String name;
	private @Getter @Setter String version;
	private @Getter @Setter boolean stubbed;
	private @Getter @Setter String type;
	private @Getter @Setter String directory;

	private @Getter @Setter String parent;

	@Override
	public String toString() {
		return name;
	}
}
