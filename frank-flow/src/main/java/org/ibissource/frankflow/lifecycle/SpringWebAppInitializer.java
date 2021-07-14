package org.ibissource.frankflow.lifecycle;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.Properties;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import javax.servlet.annotation.WebListener;

import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.context.support.WebApplicationContextUtils;

@WebListener
public class SpringWebAppInitializer implements ServletContextListener {
	private static final String NAME = "Frank!Flow";
	private static final String ARTIFACT_ID = "frank-flow"; //maven artifactId goes here!
	private AnnotationConfigWebApplicationContext context;

	@Override
	public void contextInitialized(ServletContextEvent sce) {
		String version = getModuleVersion(ARTIFACT_ID);
		sce.getServletContext().log("Loading "+NAME+" version ["+version+"]");
		context = new AnnotationConfigWebApplicationContext();

		try {
			WebApplicationContext parentApplicationContext = WebApplicationContextUtils.getWebApplicationContext(sce.getServletContext());
			if(parentApplicationContext != null) {
				context.setParent(parentApplicationContext);
			}
		}
		catch (Throwable t) {
			sce.getServletContext().log("Frank!Flow detected a WAC but was unable to set it!");
		}

		context.setDisplayName(NAME);
		context.register(Configuration.class);
		context.setServletContext(sce.getServletContext());
		context.refresh();
	}

	@Override
	public void contextDestroyed(ServletContextEvent sce) {
		sce.getServletContext().log("Shutting down Frank!Flow");
		context.close();
	}

	/**
	 * @param module name of the module to fetch the version
	 * @return module version or null if not found
	 */
	private String getModuleVersion(String module) {
		ClassLoader classLoader = this.getClass().getClassLoader();
		String basePath = "META-INF/maven/org.ibissource/";
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
}
