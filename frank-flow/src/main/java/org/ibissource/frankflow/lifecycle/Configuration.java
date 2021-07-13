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
package org.ibissource.frankflow.lifecycle;

import java.util.HashMap;
import java.util.Map;

import javax.servlet.ServletContext;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.ibissource.frankflow.BackendServlet;
import org.ibissource.frankflow.FrontendServlet;
import org.ibissource.frankflow.util.FrankFlowProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;
import org.springframework.web.context.ServletContextAware;

@org.springframework.context.annotation.Configuration
public class Configuration implements ServletContextAware {
	private Logger log = LogManager.getLogger(this);
	private String basePath = null;
	private ServletContext servletContext;

	@Bean
	@Scope("singleton")
	public String getBasePath() {
		if(basePath == null) {
			String path = FrankFlowProperties.getProperty("frank-flow.context-path", "/frank-flow/");
			if(!path.startsWith("/")) {
				path = "/"+path;
			}
			if(!path.endsWith("/")) {
				path = path+"/";
			}
	
			log.info("loading Frank!Flow using context-path ["+path+"]");
			basePath = path;

			servletContext.setAttribute("basepath", basePath);
		}
		return basePath;
	}

	@Bean
	@Scope("singleton")
	public ServletCreatorBean frontend() {
		return new ServletCreatorBean(getBasePath()+"*", FrontendServlet.class);
	}

	@Bean
	@Scope("singleton")
	public ServletCreatorBean backend() {
		Map<String, String> parameters = new HashMap<>();
		parameters.put("config-location", "ApiContext.xml");
		parameters.put("bus", "frank-flow-bus");
		return new ServletCreatorBean(getBasePath()+"api/*", BackendServlet.class, parameters);
	}

	@Override
	public void setServletContext(ServletContext servletContext) {
		this.servletContext = servletContext;
	}
}
