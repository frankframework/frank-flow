package org.ibissource.frankflow.lifecycle;

import java.io.File;

import org.apache.catalina.Context;
import org.apache.catalina.startup.Tomcat;

public class TomcatInitializer {

	public static void main(String[] args) throws Exception {
		Tomcat tomcat = new Tomcat();

		// The port that we should run on can be set into an environment variable
		// Look for that variable and default to 8080 if it isn't there.
		String webPort = System.getenv("PORT");
		if(webPort == null || webPort.isEmpty()) {
			webPort = "8080";
		}
		System.out.println("starting tomcat on port [" + webPort + "]");

		tomcat.setPort(Integer.valueOf(webPort));

		Context ctx = tomcat.addContext("", new File(".").getAbsolutePath());

		// Declare an alternative location for your "WEB-INF/classes" dir
		// Servlet 3.0 annotation will work
//		File additionWebInfClasses = new File("target/classes");
//		WebResourceRoot resources = new StandardRoot(ctx);
//		resources.addPreResources(new DirResourceSet(resources, "/WEB-INF/classes", additionWebInfClasses.getAbsolutePath(), "/"));
//		ctx.setResources(resources);

		ctx.addApplicationListener(SpringWebAppInitializer.class.getCanonicalName());

		tomcat.start();
		tomcat.getServer().await();
	}
}
