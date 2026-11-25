export function getWsdlXml(serviceUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<wsdl:definitions 
    xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" 
    xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" 
    xmlns:tns="http://www.example.org/secp/" 
    xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
    targetNamespace="http://www.example.org/secp/" 
    name="ReverseFlowService">

  <wsdl:types>
    <xsd:schema targetNamespace="http://www.example.org/secp/" elementFormDefault="qualified">
      <xsd:element name="subunsub">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="Msisdn" type="xsd:string"/>
            <xsd:element name="IdChannel" type="xsd:string"/>
            <xsd:element name="IdChannelOption" type="xsd:string"/>
            <xsd:element name="IdService" type="xsd:string"/>
            <xsd:element name="IdBundle" type="xsd:string" minOccurs="0"/>
            <xsd:element name="Timestamp" type="xsd:string"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>

      <xsd:element name="subUnsubResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="Code" type="xsd:int"/>
            <xsd:element name="Description" type="xsd:string"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </wsdl:types>

  <wsdl:message name="subunsubRequestMessage">
    <wsdl:part name="parameters" element="tns:subunsub"/>
  </wsdl:message>

  <wsdl:message name="subunsubResponseMessage">
    <wsdl:part name="parameters" element="tns:subUnsubResponse"/>
  </wsdl:message>

  <wsdl:portType name="subunsubPortType">
    <wsdl:operation name="subunsub">
      <wsdl:input message="tns:subunsubRequestMessage"/>
      <wsdl:output message="tns:subunsubResponseMessage"/>
    </wsdl:operation>
  </wsdl:portType>

  <wsdl:binding name="subunsubBinding" type="tns:subunsubPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <wsdl:operation name="subunsub">
      <soap:operation soapAction="http://www.example.org/secp/subunsub"/>
      <wsdl:input>
        <soap:body use="literal"/>
      </wsdl:input>
      <wsdl:output>
        <soap:body use="literal"/>
      </wsdl:output>
    </wsdl:operation>
  </wsdl:binding>

  <wsdl:service name="subunsubService">
    <wsdl:port name="subunsubPort" binding="tns:subunsubBinding">
      <soap:address location="${serviceUrl}"/>
    </wsdl:port>
  </wsdl:service>

</wsdl:definitions>`;
}
