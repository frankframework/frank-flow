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
package org.frankframework.frankflow.lifecycle;

import org.apache.commons.lang3.StringUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.frankframework.frankflow.standalone.LocalFlowGateway;
import org.frankframework.frankflow.util.FileUtils;
import org.frankframework.management.bus.OutboundGatewayFactory;
import org.frankframework.management.gateway.HazelcastOutboundGateway;
import org.ibissource.frankflow.FrontendServlet;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Scope;
import org.springframework.web.servlet.DispatcherServlet;

@Configuration
public class AnnotationConfig {
	private Logger log = LogManager.getLogger(this);
	private String basePath = null;

	@Value("${configurations.directory}")
	private String configurationsDirectory;

	@Autowired
	private ApplicationContext applicationContext;

	@Bean
	@Scope("singleton")
	public String getConfigurationsDirectory() {
		FileUtils.BASE_DIR = configurationsDirectory;
		log.info("using configurations.directory [{}]", configurationsDirectory);

		return basePath;
	}

	@Bean
	@Scope("singleton")
	public ServletRegistrationBean<FrontendServlet> frontend() {
		FrontendServlet frontendServlet = applicationContext.getAutowireCapableBeanFactory().createBean(FrontendServlet.class);
		ServletRegistrationBean<FrontendServlet> servlet = new ServletRegistrationBean<>(frontendServlet);
		servlet.addUrlMappings("/*");
		return servlet;
	}

	@Bean
	@Scope("singleton")
	public ServletRegistrationBean<DispatcherServlet> backend() {
		DispatcherServlet backendServlet = applicationContext.getAutowireCapableBeanFactory().createBean(DispatcherServlet.class);
		ServletRegistrationBean<DispatcherServlet> servlet = new ServletRegistrationBean<>(backendServlet);
		servlet.addUrlMappings("/api/*");
		return servlet;
	}

	@Bean
	@Scope("singleton")
	public OutboundGatewayFactory createOutboundGatewayFactory() {
		OutboundGatewayFactory factory = new OutboundGatewayFactory();
		String configDirectory = applicationContext.getEnvironment().getProperty("configurations.directory");
		String gatewayClassName = StringUtils.isEmpty(configDirectory) ? HazelcastOutboundGateway.class.getCanonicalName() : LocalFlowGateway.class.getCanonicalName();
		factory.setGatewayClassname(gatewayClassName);
		factory.setGatewayClassname(HazelcastOutboundGateway.class.getCanonicalName());
		return factory;
	}

}
