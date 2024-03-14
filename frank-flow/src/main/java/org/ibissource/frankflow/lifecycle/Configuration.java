/*
   Copyright 2020-2024 WeAreFrank!

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
import org.ibissource.frankflow.util.FileUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Scope;
import org.springframework.util.StringUtils;
import org.springframework.web.context.ServletContextAware;

@org.springframework.context.annotation.Configuration
public class Configuration implements ServletContextAware {
	private Logger log = LogManager.getLogger(this);
	private String basePath = null;
	private ServletContext servletContext;

	@Value("${frank-flow.context-path}/")
	private String contextPath; // must start with SLASH and may not end with a SLASH, or Spring will FAIL.

	@Value("${frank-flow.frontend-path:}")
	private String frontendPath;

	@Value("${configurations.directory}")
	private String configurationsDirectory;

	@Bean
	@Scope("singleton")
	public String getBasePath() {
		FileUtils.BASE_DIR = configurationsDirectory;
		log.info("using configurations.directory [{}]", configurationsDirectory);

		if(basePath == null) {
			log.info("loading Frank!Flow using context-path [{}]", contextPath);
			basePath = contextPath;

			servletContext.setAttribute("basepath", basePath);
		}

		if(StringUtils.hasLength(frontendPath)) {
			servletContext.setAttribute("frontend-location", frontendPath);
		}

		return basePath;
	}

	@Bean
	@Scope("singleton")
	public ServletRegistrationBean<FrontendServlet> frontend() {
		ServletRegistrationBean<FrontendServlet> servlet = new ServletRegistrationBean<>(new FrontendServlet());
		servlet.addUrlMappings(getBasePath()+"*");
		return servlet;
	}

	@Bean
	@Scope("singleton")
	public ServletRegistrationBean<BackendServlet> backend() {
		ServletRegistrationBean<BackendServlet> servlet = new ServletRegistrationBean<>(new BackendServlet());
		Map<String, String> parameters = new HashMap<>();
		parameters.put("config-location", "ApiContext.xml");
		parameters.put("bus", "frank-flow-bus");
		servlet.setInitParameters(parameters);
		servlet.addUrlMappings(getBasePath()+"api/*");
		return servlet;
	}

	@Override
	public void setServletContext(ServletContext servletContext) {
		this.servletContext = servletContext;
	}
}
