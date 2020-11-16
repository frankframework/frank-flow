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

import java.util.Map;

import javax.servlet.Servlet;
import javax.servlet.ServletContext;
import javax.servlet.ServletRegistration;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.springframework.web.context.ServletContextAware;

public class ServletCreatorBean implements ServletContextAware {
	private Logger log = LogManager.getLogger(this);
	private Class<? extends Servlet> servletClass;
	private String urlPattern;
	private Map<String, String> parameters;

	public ServletCreatorBean(String urlPattern, Class<? extends Servlet> servletClass) {
		this(urlPattern, servletClass, null);
	}

	public ServletCreatorBean(String urlPattern, Class<? extends Servlet> servletClass, Map<String, String> parameters) {
		this.urlPattern = urlPattern;
		this.servletClass = servletClass;
		this.parameters = parameters;
	}

	@Override
	public void setServletContext(ServletContext servletContext) {
		log.info("creating servlet endpoint ["+urlPattern+"] for servlet ["+servletClass.getSimpleName()+"]");

		ServletRegistration.Dynamic serv = servletContext.addServlet(servletClass.getSimpleName(), servletClass);
		if(parameters != null && parameters.size() > 0) {
			if(log.isDebugEnabled()) log.debug("setting init parameters ["+parameters+"] for servlet ["+servletClass.getSimpleName()+"]");
			serv.setInitParameters(parameters);
		}
		serv.addMapping(urlPattern);
	}
}
