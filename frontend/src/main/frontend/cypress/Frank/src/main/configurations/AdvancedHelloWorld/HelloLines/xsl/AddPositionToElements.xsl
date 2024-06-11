<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
	<xsl:output omit-xml-declaration="yes"/>
	<xsl:template match="*|@*|comment()|processing-instruction()|text()">
		<xsl:copy>
			<xsl:for-each select="line">
				<xsl:element name="line{position()}">
					<xsl:apply-templates/>
				</xsl:element>
			</xsl:for-each>
		</xsl:copy>
	</xsl:template>
</xsl:stylesheet>
