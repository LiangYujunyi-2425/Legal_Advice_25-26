import os
import xml.etree.ElementTree as ET

# eLegislation XML namespace
NS = {
    "hklm": "http://www.xml.gov.hk/schemas/hklm/1.0",
    "xml": "http://www.w3.org/XML/1998/namespace"
}

def extract_text_with_refs(node):
    """處理節點文字，轉換 <ref> 為 Markdown 連結"""
    if node is None:
        return ""
    parts = []
    if node.text:
        parts.append(node.text.strip())
    for child in node:
        if child.tag.endswith("ref"):
            href = child.attrib.get("href", "")
            label = (child.text or href).strip()
            if href:
                parts.append(f"[{label}]({href})")
            else:
                parts.append(label)
        else:
            parts.append(extract_text_with_refs(child))
        if child.tail:
            parts.append(child.tail.strip())
    return "".join(parts)


def parse_law(xml_file):
    """將單一香港法規 XML 轉換為 Markdown 字串"""
    tree = ET.parse(xml_file)
    root = tree.getroot()
    
    lines = []
    
    # 條例名稱
    doc_name = root.find("hklm:meta/hklm:docName", NS)
    long_title = root.find(".//hklm:longTitle/hklm:content", NS)
    if doc_name is not None and doc_name.text:
        lines.append(f"# {doc_name.text.strip()} 高等法院條例\n")
    if long_title is not None and long_title.text:
        lines.append(f"> {extract_text_with_refs(long_title)}\n")
    
    # 遍歷各部份
    for part in root.findall(".//hklm:part", NS):
        part_num = part.find("hklm:num", NS)
        part_heading = part.find("hklm:heading", NS)
        if part_num is not None:
            if part_heading is not None and part_heading.text:
                lines.append(f"## {part_num.text.strip()} {part_heading.text.strip()}\n")
            else:
                lines.append(f"## {part_num.text.strip()}\n")
        
        # 遍歷各條文
        for section in part.findall("hklm:section", NS):
            sec_num = section.find("hklm:num", NS)
            sec_heading = section.find("hklm:heading", NS)

            if sec_num is not None:
                if sec_heading is not None and sec_heading.text:
                    lines.append(f"### 第{sec_num.text.strip()}條 {sec_heading.text.strip()}\n")
                else:
                    lines.append(f"### 第{sec_num.text.strip()}條\n")
            
            # 條文主體 <text>
            text = section.find("hklm:text", NS)
            if text is not None:
                text_str = extract_text_with_refs(text)
                if text_str:
                    lines.append(text_str + "\n")
            
            # 定義 <def>
            for d in section.findall("hklm:def", NS):
                term_ch = d.find("hklm:term", NS)
                term_en = d.find("hklm:term[@xml:lang='en']", NS)
                lead_in = d.find("hklm:leadIn", NS)
                content = d.find("hklm:content", NS)
                
                term_text = term_ch.text.strip() if (term_ch is not None and term_ch.text) else ""
                en_text = term_en.text.strip() if (term_en is not None and term_en.text) else ""
                lead_text = extract_text_with_refs(lead_in) if lead_in is not None else ""
                cont_text = extract_text_with_refs(content) if content is not None else ""

                term_display = f"**{term_text} ({en_text})**" if en_text else f"**{term_text}**"
                def_line = f"{term_display}：{lead_text}{cont_text}"
                lines.append(def_line + "\n")

            # 子款 <subsection>
            for sub in section.findall("hklm:subsection", NS):
                sub_num = sub.find("hklm:num", NS)
                sub_content = sub.find("hklm:content", NS)
                if sub_num is not None:
                    content_text = extract_text_with_refs(sub_content)
                    lines.append(f"({sub_num.text.strip()}) {content_text}\n")

            # 修訂註 <sourceNote>
            for note in section.findall("hklm:sourceNote", NS):
                note_text = extract_text_with_refs(note)
                if note_text:
                    lines.append(f"（{note_text}）\n")
    
    return "\n".join(lines)


def batch_convert(input_folder, output_folder):
    """批次轉換資料夾內所有 XML → Markdown"""
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
    
    for file in os.listdir(input_folder):
        if file.lower().endswith(".xml"):
            xml_path = os.path.join(input_folder, file)
            md_name = os.path.splitext(file)[0] + ".md"
            md_path = os.path.join(output_folder, md_name)
            
            try:
                md_content = parse_law(xml_path)
                with open(md_path, "w", encoding="utf-8") as f:
                    f.write(md_content)
                print(f"✅ 轉換完成: {file} → {md_name}")
            except Exception as e:
                print(f"❌ 轉換失敗: {file}，原因: {e}")


if __name__ == "__main__":
    input_dir = "laws"     # 輸入資料夾 (放 XML)
    output_dir = "laws_md"     # 輸出資料夾 (存放 Markdown)
    batch_convert(input_dir, output_dir)
    print("🎉 全部轉換完成！")
