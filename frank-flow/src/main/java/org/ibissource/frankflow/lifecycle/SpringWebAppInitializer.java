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

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.Properties;

import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.WebApplicationInitializer;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.context.support.WebApplicationContextUtils;

import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.ServletException;

@Order(Ordered.LOWEST_PRECEDENCE)
public class SpringWebAppInitializer implements WebApplicationInitializer {
	private static final String NAME = "Frank!Flow";
	private static final String ARTIFACT_ID = "frank-flow"; //maven artifactId goes here!
	private AnnotationConfigWebApplicationContext context;

	@Override
	public void onStartup(ServletContext servletContext) throws ServletException {
		String version = getModuleVersion(ARTIFACT_ID);
		servletContext.log("Loading "+NAME+" version ["+version+"]");
		context = new AnnotationConfigWebApplicationContext();
		servletContext.addListener(new ContextCloseEventListener(context));

		try {
			WebApplicationContext parentApplicationContext = WebApplicationContextUtils.getWebApplicationContext(servletContext);
			if(parentApplicationContext != null) {
				context.setParent(parentApplicationContext);
			}
		}
		catch (Throwable t) {
			servletContext.log("Frank!Flow detected a WAC but was unable to set it!");
		}

		context.setDisplayName(NAME);
		context.register(AnnotationConfig.class);
		context.setServletContext(servletContext);
		context.refresh();
	}

	/**
	 * @param module name of the module to fetch the version
	 * @return module version or null if not found
	 */
	private String getModuleVersion(String module) {
		ClassLoader classLoader = this.getClass().getClassLoader();
		String basePath = "META-INF/maven/org.frankframework/";
		URL pomProperties = classLoader.getResource(basePath+module+"/pom.properties");

		if(pomProperties != null) {
			try(InputStream is = pomProperties.openStream()) {
				Properties props = new Properties();
				props.load(is);
				return (String) props.get("version");
			} catch (IOException e) {
				return "unknown";
			}
		}

		// unable to find module, assume it's not on the classpath
		return "error";
	}

	private static class ContextCloseEventListener implements ServletContextListener {
		private ConfigurableApplicationContext context;

		public ContextCloseEventListener(ConfigurableApplicationContext context) {
			this.context = context;
		}

		@Override
		public void contextInitialized(ServletContextEvent sce) {
			// We don't need to initialize anything, just listen to the close event.
		}

		@Override
		public void contextDestroyed(ServletContextEvent sce) {
			ServletContext servletContext = sce.getServletContext();
			servletContext.log("Shutting down Frank!Flow");
			context.close();
		}
	}
}
