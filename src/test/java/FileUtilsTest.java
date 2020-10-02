import java.io.File;

import javax.json.JsonArrayBuilder;
import javax.json.JsonObjectBuilder;

import org.ibissource.frankflow.api.Configurations;
import org.junit.Test;

public class FileUtilsTest {

	@Test
	public void tralala() {
		File dir = new File("C:/Data/Configurations/NewHorizons");
		JsonObjectBuilder out = Configurations.readDirectory(dir);
		System.out.println(out.build());
	}
}
