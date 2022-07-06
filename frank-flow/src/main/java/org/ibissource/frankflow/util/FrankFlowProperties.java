package org.ibissource.frankflow.util;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.Properties;

public class FrankFlowProperties {
	private Properties props = new Properties();
	private static FrankFlowProperties self;

	private FrankFlowProperties() {
		File dir = new File("").getAbsoluteFile(); //Launch directory
		File propertiesFile = new File(dir, "frank-flow.properties");
		URL propertiesURL = null;

		if(propertiesFile.exists()) {
			try {
				propertiesURL = propertiesFile.toURI().toURL();
			} catch (MalformedURLException e) {
				System.out.println("unable to load properties from url ["+propertiesFile+"]");
				e.printStackTrace();
			}
		} else {
			propertiesURL = FrankFlowProperties.class.getResource("/frank-flow.properties");
		}

		if(propertiesURL == null) {
			System.out.println("no properties file found!");
		} else {
			try(InputStream is = propertiesURL.openStream()) {
				System.out.println("Using properties file ["+propertiesURL+"]");
	
				props.load(is);
			} catch (IOException e) {
				throw new IllegalStateException("unable to load Frank!Flow properties", e);
			}
		}
	}

	private Properties getProperties() {
		return props;
	}

	public static FrankFlowProperties getInstance() {
		if(self == null) {
			self = new FrankFlowProperties();
		}

		return self;
	}

	public static String getProperty(String string) {
		return getProperty(string, null);
	}

	public static String getProperty(String string, String defaultValue) {
		String value = getInstance().getProperties().getProperty(string);
		if(value == null) {
			value = System.getProperty(string);
		}
		if(value == null) {
			value = defaultValue;
		}
		return value;
	}
}
