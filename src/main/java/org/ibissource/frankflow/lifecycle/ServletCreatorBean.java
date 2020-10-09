package org.ibissource.frankflow.lifecycle;

import java.util.Map;

import javax.servlet.Servlet;
import javax.servlet.ServletContext;
import javax.servlet.ServletRegistration;

import org.springframework.web.context.ServletContextAware;

public class ServletCreatorBean implements ServletContextAware {
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
		System.out.println("creating servlet endpoint ["+urlPattern+"] for servlet ["+servletClass.getSimpleName()+"]");

		ServletRegistration.Dynamic serv = servletContext.addServlet(servletClass.getSimpleName(), servletClass);
		if(parameters != null && parameters.size() > 0) {
			serv.setInitParameters(parameters);
		}
		serv.addMapping(urlPattern);
	}
}
