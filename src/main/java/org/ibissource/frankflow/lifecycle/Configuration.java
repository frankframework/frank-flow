package org.ibissource.frankflow.lifecycle;

import java.util.HashMap;
import java.util.Map;

import org.ibissource.frankflow.BackendServlet;
import org.ibissource.frankflow.FrontendServlet;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;

@org.springframework.context.annotation.Configuration
public class Configuration {
	public static final String BASEPATH = System.getProperty("frank-flow.basepath", "/frank-flow/");

	@Bean
	@Scope("singleton")
	public String test() {
		System.out.println("some super bean loading things and being awesome thanks!");

		return "test string";
	}

	@Bean
	@Scope("singleton")
	public ServletCreatorBean frontend() {
		return new ServletCreatorBean(BASEPATH+"*", FrontendServlet.class);
	}

	@Bean
	@Scope("singleton")
	public ServletCreatorBean backend() {
		Map<String, String> parameters = new HashMap<>();
		parameters.put("config-location", "ApiContext.xml");
		parameters.put("bus", "frank-flow-bus");
		return new ServletCreatorBean(BASEPATH+"api/*", BackendServlet.class, parameters);
	}
}
